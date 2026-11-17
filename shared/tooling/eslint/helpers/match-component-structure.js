import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import { matchesVueComponentOrRoot } from '#eslint/helpers/matches-vue-component-or-root.js';
import { isImportedLucideIcon } from '#eslint/helpers/is-imported-lucide-icon.js';

function meaningfulChildren(node) {
    return node.children.filter((child) => child.type !== 'VComment' && child.type !== 'VHTMLComment'
        && !(child.type === 'VText' && /^\s*$/.test(child.value)));
}

const transparentWrappers = {
    Transition: {children: 'default'},
    ContextMenu: {children: 'ContextMenuTrigger', requireAsChild: true},
    Tooltip: {children: 'TooltipTrigger', requireAsChild: true},
};

export function hasAsChild(node) {
    let enabled = false;
    for (const attribute of node.startTag.attributes) {
        if (!attribute.directive) {
            if (['as-child', 'asChild'].includes(attribute.key.rawName)) enabled = !attribute.value || attribute.value.value === '';
            continue;
        }
        if (attribute.key.name.name !== 'bind') continue;
        const argument = attribute.key.argument;
        // A spread or dynamic argument could override as-child.
        if (argument?.type !== 'VIdentifier') return false;
        if (['as-child', 'asChild'].includes(argument.rawName)) {
            enabled = !attribute.key.modifiers.length && attribute.value?.expression?.type === 'Literal'
                && attribute.value.expression.value === true;
        }
    }
    return enabled;
}

// Keep logical children separate from the source subtrees that contain them.
// Explicit declarations (including forbidden ones) always take precedence.
function projectChildren(node, entries, matches) {
    const declarations = entries.flatMap((entry) => entry.group ? entry.children : [entry]);

    function project(child) {
        const direct = [{node: child, sourceNode: child, beforeNode: child, afterNode: child}];
        if (declarations.some((entry) => matches(child, entry.name))) return direct;
        if (child.type === 'VElement' && child.rawName === 'template'
            && child.startTag.attributes.some((attribute) => attribute.directive
                && ['if', 'else-if', 'else', 'for'].includes(attribute.key.name.name))
            && !child.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'slot')) {
            const projected = meaningfulChildren(child).flatMap(project);
            if (!projected.length) return direct;
            for (const candidate of projected) candidate.sourceNode = child;
            projected[0].beforeNode = child;
            projected.at(-1).afterNode = child;
            return projected;
        }
        const wrapper = Object.entries(transparentWrappers).find(([name]) => matchesVueComponentName(child, name))?.[1];
        if (!wrapper) return direct;

        let content = child;
        if (wrapper.children !== 'default') {
            const triggers = meaningfulChildren(child).filter((candidate) => matchesVueComponentName(candidate, wrapper.children));
            if (triggers.length !== 1 || (wrapper.requireAsChild && !hasAsChild(triggers[0]))) return direct;
            content = triggers[0];
        }
        const projected = meaningfulChildren(content).flatMap(project);
        // An empty or invalid wrapper remains visible to ordinary diagnostics.
        if (!projected.length) return direct;
        for (const candidate of projected) candidate.sourceNode = child;
        projected[0].beforeNode = child;
        projected.at(-1).afterNode = child;
        return projected;
    }

    return meaningfulChildren(node).flatMap(project);
}

// Expand transparent sibling patterns per parent, keeping each occurrence distinct.
function expandGroups(entries, actual, matches) {
    if (!entries.some((entry) => entry.group)) return {entries, choices: []};

    const remaining = new Map();
    for (const entry of entries.flatMap((entry) => entry.group ? entry.children : [entry])) {
        if (!entry.special && !remaining.has(entry.name)) {
            remaining.set(entry.name, actual.filter((node) => matches(node, entry.name)).length);
        }
    }
    const minimum = (entries, name, consuming = [name]) => entries.reduce((count, entry) => {
        if (!entry.required || entry.special) return count;
        if (!entry.group) return count + Number(entry.name === name);
        if (!entry.oneOf) return count + minimum(entry.children, name, consuming);
        const selected = entry.children.find((child) => !consuming.includes(child.name) && (remaining.get(child.name) ?? 0) > 0)
            ?? entry.children.find((child) => (remaining.get(child.name) ?? 0) > 0) ?? entry.children[0];
        return count + Number(selected.name === name);
    }, 0);
    const expanded = [];
    const choices = [];

    for (const [index, entry] of entries.entries()) {
        const later = entries.slice(index + 1);
        if (!entry.group) {
            expanded.push(entry);
            if (!entry.special && !entry.forbidden) {
                const count = remaining.get(entry.name) ?? 0;
                const consumed = entry.repeatable ? Math.max(entry.required ? 1 : 0, count - minimum(later, entry.name)) : 1;
                remaining.set(entry.name, Math.max(0, count - consumed));
            }
            continue;
        }

        if (entry.oneOf) {
            const selected = entry.required
                ? entry.children.find((child) => (remaining.get(child.name) ?? 0) > 0) ?? entry.children[0]
                : undefined;
            const groupScope = {path: entry.path, token: {}};
            const alternatives = entry.children.map((child) => ({...child, groupScope, required: child === selected, alternative: true}));
            expanded.push(...alternatives);
            choices.push({entry, alternatives});
            for (const child of alternatives) remaining.set(child.name, Math.max(0, (remaining.get(child.name) ?? 0) - 1));
            continue;
        }

        const occurrences = new Map();
        for (const child of entry.children) {
            if (!child.special) occurrences.set(child.name, (occurrences.get(child.name) ?? 0) + 1);
        }
        let repetitions = entry.required ? 1 : 0;
        for (const [name, count] of occurrences) {
            repetitions = Math.max(repetitions, Math.ceil(((remaining.get(name) ?? 0) - minimum(later, name, [...occurrences.keys()])) / count));
        }
        if (!entry.repeatable) repetitions = Math.min(1, repetitions);
        for (let repetition = 0; repetition < repetitions; repetition++) {
            const groupScope = {path: entry.path, token: {}};
            for (const child of entry.children) {
                expanded.push({...child, groupScope});
                if (!child.special) remaining.set(child.name, Math.max(0, (remaining.get(child.name) ?? 0) - 1));
            }
        }
    }

    return {entries: expanded, choices};
}

// Match sibling occurrences, not a global map keyed by component name.
// Matching independently of order allows order errors without false missing errors.
export function matchComponentStructure(entry, node, parent = null, sourceCode = parent?.sourceCode) {
    const external = entry.name === 'Icon'
        ? !sourceCode || !isImportedLucideIcon(node, sourceCode)
        : !matchesVueComponentName(node, entry.name);
    const declarations = (entry.children ?? []).flatMap((child) => child.group ? child.children : [child]);
    const matches = (candidate, name) => name === 'Icon'
        ? Boolean(sourceCode && candidate.type === 'VElement' && isImportedLucideIcon(candidate, sourceCode))
        : matchesVueComponentName(candidate, name)
        || (!declarations.some((child) => matchesVueComponentName(candidate, child.name))
            && matchesVueComponentOrRoot(candidate, name, sourceCode));
    const projected = external ? [] : projectChildren(node, entry.children ?? [], matches);
    const actual = projected.map((child) => child.node);
    const groups = new Map(parent?.groups);
    if (entry.groupScope) groups.set(entry.groupScope.path, entry.groupScope.token);
    const instance = {entry, node, sourceNode: node, beforeNode: node, afterNode: node, sourceCode, external, parent, groups, actual, hasContent: actual.length > 0, entries: external ? null : entry.children, children: [], missing: [], choices: [], unexpected: [], outOfOrder: false};
    if (external || entry.children === null) return instance;

    const expanded = expandGroups(entry.children, actual, matches);
    instance.entries = expanded.entries;
    const expected = instance.entries.filter((child) => !child.special && !child.forbidden);
    const available = new Set(actual);

    for (const [index, child] of expected.entries()) {
        const candidates = actual.filter((candidate) => available.has(candidate) && matches(candidate, child.name));
        const requiredLater = expected.slice(index + 1).filter((later) => later.required && later.name === child.name).length;

        if (!candidates.length) {
            if (child.required && !child.alternative) instance.missing.push(child);
            continue;
        }

        // Each later required entry needs at least one occurrence, even if repeatable.
        const minimum = child.required ? 1 : 0;
        let count = Math.max(minimum, candidates.length - requiredLater);
        if (!child.repeatable) count = Math.min(count, 1);

        // A declared separator distinguishes groups that reuse the same name.
        const nextSameName = expected.findIndex((later, laterIndex) => laterIndex > index && later.name === child.name);
        if (nextSameName > index + 1) {
            const between = expected.slice(index + 1, nextSameName);
            const boundary = actual.find((candidate) => available.has(candidate)
                && between.some((separator) => matches(candidate, separator.name)));
            if (boundary) {
                const beforeBoundary = candidates.filter((candidate) => candidate.range[0] < boundary.range[0]).length;
                count = Math.min(count, Math.max(minimum, beforeBoundary));
            }
        }

        for (const candidate of candidates.slice(0, count)) {
            available.delete(candidate);
            const matched = matchComponentStructure(child, candidate, instance);
            Object.assign(matched, projected.find((item) => item.node === candidate));
            instance.children.push(matched);
        }
    }

    instance.unexpected = [...available];
    for (const choice of expanded.choices) {
        const members = instance.children.filter((child) => choice.alternatives.includes(child.entry));
        if (members.length > 1 || (choice.entry.required && !members.length)) instance.choices.push({...choice, members});
    }
    instance.outOfOrder = !entry.unordered && instance.children.some((child, index, siblings) => index > 0
        && siblings[index - 1].node.range[0] > child.node.range[0]);

    return instance;
}
