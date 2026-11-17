import { getVueAttributeBindings } from '#eslint/helpers/get-vue-attribute-bindings.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

// Families opt into column matching; ordinary comment references do not use table layout.
export function getTableColumnCommentSource({sourceCode, instance, candidates, scope}) {
    const reference = instance.entry.comment.from;

    function span(node, name) {
        const bindings = getVueAttributeBindings(sourceCode, node);
        if (!bindings) return undefined;
        const attribute = [...bindings.attributes]
            .filter(([key]) => key.toLowerCase() === name)
            .map(([, value]) => value)
            .sort((left, right) => left.node.range[0] - right.node.range[0]).at(-1);
        if (!attribute) return bindings.uncertain ? undefined : 1;
        if (attribute.value == null) return 1;
        const value = typeof attribute.value === 'number' ? attribute.value
            : typeof attribute.value === 'string' && /^\d+$/.test(attribute.value) ? Number(attribute.value) : undefined;
        return Number.isSafeInteger(value) && value > 0 ? value : undefined;
    }

    function columns(cell) {
        const row = cell.parent;
        if (!row) return undefined;
        // Rowspans can shift later rows. Leave that layout for the agent instead of guessing.
        for (const previous of row.node.parent?.children ?? []) {
            if (previous === row.node) break;
            if (previous.type !== 'VElement') continue;
            if (!matchesVueComponentName(previous, row.entry.name)
                || previous.children.some((child) => child.type === 'VElement' && span(child, 'rowspan') !== 1)) return undefined;
        }
        let start = 0;
        for (const sibling of row.node.children) {
            if (sibling.type === 'VText' && !sibling.value.trim()) continue;
            if (sibling.type === 'VComment' || sibling.type === 'VHTMLComment') continue;
            if (![instance.entry.name, reference.name].some((name) => matchesVueComponentName(sibling, name))
                || sibling.startTag.attributes.some((attribute) => attribute.directive
                    && ['if', 'else-if', 'else', 'for', 'show'].includes(attribute.key.name.name))
                || span(sibling, 'rowspan') !== 1) return undefined;
            const width = span(sibling, 'colspan');
            if (!width || !Number.isSafeInteger(start + width)) return undefined;
            if (sibling === cell.node) return {start, end: start + width};
            start += width;
        }
        return undefined;
    }

    const target = columns(instance);
    if (!target) return undefined;
    const matching = [];
    for (const candidate of candidates) {
        // Conditional/repeated header cells or rows do not define a stable column map.
        for (let node = candidate.node; node && node !== scope.node; node = node.parent) {
            if (node.startTag?.attributes.some((attribute) => attribute.directive
                && ['if', 'else-if', 'else', 'for', 'show'].includes(attribute.key.name.name))) return undefined;
        }
        const source = columns(candidate);
        if (!source) return undefined;
        if (source.start < target.end && target.start < source.end) {
            if (source.start > target.start || source.end < target.end) return undefined;
            matching.push(candidate);
        }
    }
    return matching.length === 1 ? matching[0] : undefined;
}
