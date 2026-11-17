import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

const supportedFlags = new Set(['required', 'optional', 'forbidden', 'repeatable', 'one-of', 'comment-source', 'single-liner', 'single-liner:unless-child-elements', 'multi-liner', 'single-liner-attributes', 'multi-liner-attributes', 'self-closing', 'blank-line-between-children', 'blank-line-after-if-next-sibling', 'no-blank-line-between-children', 'no-direct-child-comments', 'non-empty', 'unordered', 'first-in-parent', 'top-level', 'last-in-template', 'once-per-file', 'label-required', 'label-after-first-icon', 'label-sr-only-when-dynamic']);
const countedAttributeLayout = /^single-liner-attributes-otherwise-multi-liner-at-([1-9]\d*)$/;
const attributeCommentSource = /^comment-source:[a-zA-Z_][\w.:-]*$/;
const specialNames = new Set(['Comment', 'BlankLine']);
const attributeName = /^@?[a-zA-Z_][\w:-]*$/;
const requiredIfBound = /^required-if-bound:([a-zA-Z_][\w:-]*)$/;
const requiredIfDescendant = /^required-if-descendant:([a-zA-Z_][\w.-]*)$/;
const attributeMatch = /^matches:([a-zA-Z_][\w-]*)\.([a-zA-Z_][\w:-]*)$/;

export function compileComponentStructure(structure) {
    function invalid(path, message) {
        throw new TypeError(`Invalid component structure at ${path}: ${message}`);
    }

    function compile(entries, path, unorderedChildren = false) {
        if (!Array.isArray(entries)) invalid(path, 'expected an array.');

        const compiled = entries.map((entry, index) => {
            const position = `${path}[${index}]`;
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)
                || Object.keys(entry).length !== 1) {
                invalid(position, 'each entry must contain exactly one name.');
            }

            const [name, options] = Object.entries(entry)[0];
            if (!name || !options || typeof options !== 'object' || Array.isArray(options)) {
                invalid(position, 'expected a name and an options object.');
            }
            if (Object.keys(options).some((key) => !['flags', 'children', 'attributes'].includes(key))) {
                invalid(position, 'only flags, children, and attributes are supported. Attribute order belongs to html-opening-tags-require-attribute-order-P2.js.');
            }
            if (!Array.isArray(options.flags) || options.flags.some((flag) => typeof flag !== 'string'
                || (!supportedFlags.has(flag) && !countedAttributeLayout.test(flag) && !attributeCommentSource.test(flag) && !flag.startsWith('text:') && !flag.startsWith('not-within:') && !flag.startsWith('comment-from:')))
                || new Set(options.flags).size !== options.flags.length) {
                invalid(position, `flags must contain unique, supported values: ${[...supportedFlags].join(', ')}, single-liner-attributes-otherwise-multi-liner-at-<positive integer>, comment-source:<attribute>, text:<content>, not-within:<component,...>, comment-from:<component>.`);
            }
            const textFlags = options.flags.filter((flag) => flag.startsWith('text:'));
            const text = textFlags[0]?.slice('text:'.length).trim();
            if (textFlags.length && (name !== 'Comment' || textFlags.length !== 1 || !text || /[\r\n]/.test(textFlags[0]))) {
                invalid(position, 'text:<content> is only allowed once on Comment, with nonempty, single-line text.');
            }
            const referenceFlags = options.flags.filter((flag) => flag.startsWith('comment-from:'));
            const referenceName = referenceFlags[0]?.slice('comment-from:'.length);
            if (referenceFlags.length && (name !== 'Comment' || referenceFlags.length !== 1 || !/^[a-zA-Z_][\w.-]*$/.test(referenceName))) {
                invalid(position, 'comment-from:<component> is only allowed once on Comment, with a single component name.');
            }
            if (referenceFlags.length && textFlags.length) invalid(position, 'comment-from and text cannot be used together.');
            const from = referenceName ? {name: referenceName} : undefined;
            const notWithinFlags = options.flags.filter((flag) => flag.startsWith('not-within:'));
            const notWithin = notWithinFlags[0]?.slice('not-within:'.length).split(',').map((name) => name.trim()) ?? [];
            if (notWithinFlags.length && (name !== 'Comment' || notWithinFlags.length !== 1
                || /[\r\n]/.test(notWithinFlags[0]) || notWithin.some((name) => !/^[a-zA-Z_][\w.-]*$/.test(name))
                || new Set(notWithin).size !== notWithin.length)) {
                invalid(position, 'not-within:<component,...> is only allowed once on Comment, with unique comma-separated component names.');
            }
            const required = options.flags.includes('required');
            const forbidden = options.flags.includes('forbidden');
            const group = name === 'Group';
            const oneOf = options.flags.includes('one-of');
            if (options.flags.filter((flag) => ['required', 'optional', 'forbidden'].includes(flag)).length !== 1) {
                invalid(position, 'choose exactly one of required, optional, or forbidden.');
            }
            if (forbidden && (specialNames.has(name) || group || options.flags.length !== 1 || 'children' in options)) {
                invalid(position, 'forbidden components cannot be Comment or BlankLine, declare children, or use other flags.');
            }
            if (options.flags.includes('single-liner') && options.flags.includes('multi-liner')) {
                invalid(position, 'single-liner and multi-liner cannot be used together.');
            }
            if (options.flags.includes('single-liner:unless-child-elements')
                && (options.flags.includes('single-liner') || options.flags.includes('multi-liner'))) {
                invalid(position, 'single-liner:unless-child-elements cannot be combined with another element layout.');
            }
            const layout = options.flags.find((flag) => flag === 'single-liner'
                || flag === 'single-liner:unless-child-elements' || flag === 'multi-liner');
            const attributeLayouts = options.flags.filter((flag) => ['single-liner-attributes', 'multi-liner-attributes'].includes(flag) || countedAttributeLayout.test(flag));
            const attributeLayout = attributeLayouts[0];
            const threshold = attributeLayout?.match(countedAttributeLayout);
            const attributeMultilineAt = threshold ? Number(threshold[1]) : undefined;
            if (threshold && !Number.isSafeInteger(attributeMultilineAt)) {
                invalid(position, 'the attribute layout threshold must be a positive safe integer.');
            }
            if (attributeLayouts.length > 1) {
                invalid(position, 'choose only one attribute layout: single-liner-attributes, multi-liner-attributes, or single-liner-attributes-otherwise-multi-liner-at-<positive integer>.');
            }
            if ((layout === 'single-liner' || layout === 'single-liner:unless-child-elements')
                && (attributeLayout === 'multi-liner-attributes' || attributeMultilineAt !== undefined)) {
                invalid(position, `${layout} and ${attributeLayout} cannot be used together.`);
            }
            const nonEmpty = options.flags.includes('non-empty');
            const selfClosing = options.flags.includes('self-closing');
            const blankLineBetweenChildren = options.flags.includes('blank-line-between-children');
            const blankLineAfterIfNextSibling = options.flags.includes('blank-line-after-if-next-sibling');
            const noBlankLineBetweenChildren = options.flags.includes('no-blank-line-between-children');
            const noDirectChildComments = options.flags.includes('no-direct-child-comments');
            const unordered = options.flags.includes('unordered');
            const repeatable = options.flags.includes('repeatable');
            const firstInParent = options.flags.includes('first-in-parent');
            const topLevel = options.flags.includes('top-level');
            const lastInTemplate = options.flags.includes('last-in-template');
            const oncePerFile = options.flags.includes('once-per-file');
            const labelRequired = options.flags.includes('label-required');
            const labelAfterFirstIcon = options.flags.includes('label-after-first-icon');
            const labelSrOnlyWhenDynamic = options.flags.includes('label-sr-only-when-dynamic');
            if ((labelAfterFirstIcon || labelSrOnlyWhenDynamic) && !labelRequired) {
                invalid(position, 'label-after-first-icon and label-sr-only-when-dynamic require label-required.');
            }
            if (labelRequired && (specialNames.has(name) || group || selfClosing)) {
                invalid(position, 'label-required can only be declared on a component with child content.');
            }
            const commentSources = options.flags.filter((flag) => flag === 'comment-source' || flag.startsWith('comment-source:'));
            const special = specialNames.has(name);
            if (firstInParent && (special || group)) {
                invalid(position, 'first-in-parent can only be declared on a component.');
            }
            if (oncePerFile && (special || group)) {
                invalid(position, 'once-per-file can only be declared on a component.');
            }
            const attributes = [];
            if ('attributes' in options) {
                if (special || group || forbidden) invalid(position, 'attributes can only be declared on an allowed component.');
                if (!options.attributes || typeof options.attributes !== 'object' || Array.isArray(options.attributes)) {
                    invalid(position, 'attributes must be an object mapping attribute names to constraint arrays.');
                }
                const names = new Set();
                for (const [name, constraints] of Object.entries(options.attributes)) {
                    const normalized = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                    if (!attributeName.test(name) || names.has(normalized)) invalid(position, 'attribute names must be valid and unique, including camelCase/kebab-case aliases.');
                    names.add(normalized);
                    if (!Array.isArray(constraints) || !constraints.length || new Set(constraints).size !== constraints.length
                        || constraints.some((flag) => typeof flag !== 'string' || !(['required', 'bound', 'non-empty'].includes(flag) || attributeMatch.test(flag)
                            || requiredIfBound.test(flag) || requiredIfDescendant.test(flag)
                            || (flag.startsWith('value:') && flag.slice(6).trim() && !/[\r\n]/.test(flag))))) {
                        invalid(position, `constraints for ${name} must be unique values: required, bound, non-empty, required-if-bound:<attribute>, required-if-descendant:<Component>, value:<text>, matches:<Component>.<attribute>.`);
                    }
                    const values = constraints.filter((flag) => flag.startsWith('value:'));
                    const matches = constraints.filter((flag) => flag.startsWith('matches:'));
                    if (values.length > 1 || matches.length > 1) invalid(position, `declare at most one value and one matches constraint for ${name}.`);
                    const match = matches[0]?.match(attributeMatch);
                    if (name.startsWith('@') && constraints.includes('bound')) invalid(position, 'event listeners use @event, not bound.');
                    attributes.push({name, required: constraints.includes('required'), bound: constraints.includes('bound'),
                        requiredIfBound: constraints.flatMap((flag) => flag.match(requiredIfBound)?.slice(1) ?? []),
                        requiredIfDescendant: constraints.flatMap((flag) => flag.match(requiredIfDescendant)?.slice(1) ?? []),
                        nonEmpty: constraints.includes('non-empty'), value: values[0]?.slice(6),
                        match: match ? {name: match[1], attribute: match[2]} : undefined});
                }
            }
            if (blankLineBetweenChildren && (special || group)) {
                invalid(position, 'blank-line-between-children can only be declared on a component.');
            }
            for (const flag of ['no-blank-line-between-children', 'no-direct-child-comments', 'blank-line-after-if-next-sibling']) {
                if (options.flags.includes(flag) && (special || group)) {
                    invalid(position, `${flag} can only be declared on a component.`);
                }
            }
            if (blankLineBetweenChildren && noBlankLineBetweenChildren) {
                invalid(position, 'blank-line-between-children and no-blank-line-between-children cannot be used together.');
            }
            if (blankLineBetweenChildren && (selfClosing || layout === 'single-liner')) {
                invalid(position, 'blank-line-between-children cannot be combined with self-closing or single-liner.');
            }
            if (selfClosing && (special || group)) {
                invalid(position, 'self-closing can only be declared on a component.');
            }
            if (selfClosing && (nonEmpty || layout === 'multi-liner')) {
                invalid(position, 'self-closing cannot be combined with non-empty or multi-liner.');
            }
            if (nonEmpty && (special || group)) {
                invalid(position, 'non-empty can only be declared on a component.');
            }
            if (unordered && (special || group)) {
                invalid(position, 'unordered can only be declared on a component.');
            }
            if (special && (topLevel || lastInTemplate)) {
                invalid(position, `${name} cannot use template placement flags.`);
            }
            if (special && ('children' in options || commentSources.length || layout || attributeLayout || repeatable)) {
                invalid(position, `${name} cannot have children, be a comment-source, use layout flags, or be repeatable.`);
            }
            if (oneOf && !group) invalid(position, 'one-of can only be declared on Group.');
            if (group && (layout || attributeLayout || commentSources.length || topLevel || lastInTemplate || (oneOf && repeatable))) {
                invalid(position, 'Group supports required or optional, with either repeatable or one-of.');
            }
            const children = 'children' in options ? compile(options.children, `${position}.${name}.children`, unordered) : null;
            const directEntries = children?.flatMap((child) => child.group ? child.children : [child]) ?? [];
            if (noBlankLineBetweenChildren && directEntries.some((child) => child.name === 'BlankLine' && child.required)) {
                invalid(position, 'no-blank-line-between-children cannot be combined with required BlankLine entries at the same child level.');
            }
            if (noBlankLineBetweenChildren && directEntries.some((child) => child.blankLineAfterIfNextSibling)) {
                invalid(position, 'no-blank-line-between-children cannot be combined with blank-line-after-if-next-sibling on its declared children.');
            }
            if (noDirectChildComments && directEntries.some((child) => child.name === 'Comment' && child.required
                && !child.notWithin.some((ancestor) => matchesVueComponentName({type: 'VElement', rawName: name}, ancestor)))) {
                invalid(position, 'no-direct-child-comments cannot be combined with required Comment entries at the same child level; remove the requirement or exclude this parent with not-within.');
            }
            if (selfClosing && children?.length) {
                invalid(position, 'self-closing cannot declare child entries; omit children or use an empty array.');
            }
            if (unordered) {
                if (!children?.length || children.some((child) => child.group)) {
                    invalid(position, 'unordered requires declared children without Group entries.');
                }
                const names = children.filter((child) => !child.special).map((child) => child.name);
                if (new Set(names).size !== names.length) {
                    invalid(position, 'unordered children must use unique component names; use repeatable for multiple occurrences.');
                }
            }
            if (group) {
                if (!children?.some((child) => !child.special && child.required)) {
                    invalid(position, 'Group must contain at least one required component.');
                }
                if (children.some((child) => child.group || child.forbidden || child.repeatable)) {
                    invalid(position, 'Group members cannot themselves be Group, forbidden, or repeatable; put nested patterns inside a component.');
                }
                if (oneOf && children.some((child) => child.special || !child.required)) {
                    invalid(position, 'one-of Group children must be required component alternatives.');
                }
            }

            return {
                name,
                path: position,
                required,
                forbidden,
                repeatable,
                special,
                group,
                oneOf,
                layout,
                attributeLayout,
                attributeMultilineAt,
                selfClosing,
                blankLineBetweenChildren,
                blankLineAfterIfNextSibling,
                noBlankLineBetweenChildren,
                noDirectChildComments,
                nonEmpty,
                unordered,
                firstInParent,
                topLevel,
                lastInTemplate,
                oncePerFile,
                labelRequired,
                labelAfterFirstIcon,
                labelSrOnlyWhenDynamic,
                commentSources,
                text,
                from,
                notWithin,
                attributes,
                children,
            };
        });

        for (const [index, entry] of compiled.entries()) {
            if (entry.name === 'Comment') {
                const target = compiled[index + 1];
                if (!target || target.special || target.group || target.forbidden) invalid(entry.path, 'Comment must immediately precede an allowed component entry.');
                target.comment = entry;
            }
            if (entry.name !== 'BlankLine') continue;
            const before = compiled.slice(0, index).reverse().find((item) => !item.special && !item.forbidden);
            const after = compiled.slice(index + 1).find((item) => !item.special && !item.forbidden);
            if (!before && !after) invalid(entry.path, 'BlankLine requires at least one component in its structure.');
            if (unorderedChildren) {
                // Like Comment, spacing belongs to each occurrence of the following component.
                const target = compiled[index + (compiled[index + 1]?.name === 'Comment' ? 2 : 1)];
                if (!after) {
                    before.blankLineAfter = entry;
                    continue;
                }
                if (!target || target.special || target.group || target.forbidden) {
                    invalid(entry.path, 'BlankLine in unordered children must precede an allowed component, optionally with Comment between them.');
                }
                target.blankLine = entry;
            }
        }

        return compiled;
    }

    const entries = compile(structure, 'structure');
    const roots = entries.filter((entry) => !entry.special);
    if (roots.length !== 1) invalid('structure', 'declare exactly one root component, optionally preceded by Comment and surrounded by BlankLine entries.');
    const rootIndex = entries.indexOf(roots[0]);
    roots[0].blankLineBeforeRoot = entries.slice(0, rootIndex).some((entry) => entry.name === 'BlankLine' && entry.required);
    roots[0].blankLineAfterRoot = entries.slice(rootIndex + 1).some((entry) => entry.name === 'BlankLine' && entry.required);
    if (roots[0].group) invalid(roots[0].path, 'Group must be inside a component; it does not create an element.');
    if (roots[0].firstInParent) invalid(roots[0].path, 'first-in-parent requires a declared parent.');
    if (roots[0].forbidden) invalid(roots[0].path, 'the root component cannot be forbidden.');

    // A forbidden declaration bans the named component throughout the template.
    const declarations = new Map();
    const pending = [...roots];
    for (const entry of pending) {
        if (entry.special) continue;
        if (entry.group) {
            pending.push(...entry.children);
            continue;
        }
        if (entry !== roots[0] && (entry.topLevel || entry.lastInTemplate)) {
            invalid(entry.path, 'top-level and last-in-template can only be declared on the root component.');
        }
        if (declarations.has(entry.name) && declarations.get(entry.name) !== entry.forbidden) {
            invalid(entry.path, `${entry.name} cannot be both allowed and forbidden.`);
        }
        declarations.set(entry.name, entry.forbidden);
        pending.push(...(entry.children ?? []));
    }

    // Resolve references by declaration, so a missing target cannot fall back to another occurrence.
    function descendants(entry) {
        return [entry, ...(entry.children ?? []).flatMap(descendants)];
    }
    function resolveReferences(entry, ancestors = []) {
        for (const attribute of entry.attributes) {
            if (!attribute.match) continue;
            const target = attribute.match;
            for (const scope of [entry, ...ancestors]) {
                const targets = descendants(scope).filter((candidate) => !candidate.special && !candidate.group && !candidate.forbidden && candidate.name === target.name);
                if (!targets.length) continue;
                Object.assign(target, {scopePath: scope.path, group: scope.group, paths: new Set(targets.map((candidate) => candidate.path))});
                break;
            }
            if (!target.scopePath) invalid(entry.path, `matches:${target.name}.${target.attribute} has no allowed target in this structure.`);
        }
        const reference = entry.comment?.from;
        if (reference) {
            for (const scope of [entry, ...ancestors]) {
                const targets = descendants(scope).filter((candidate) => candidate !== entry
                    && !candidate.special && !candidate.group && !candidate.forbidden && candidate.name === reference.name);
                if (!targets.length) continue;
                if (targets.some((target) => target.comment?.from)) {
                    invalid(entry.comment.path, 'comment-from cannot copy from another comment-from declaration.');
                }
                Object.assign(reference, {scopePath: scope.path, group: scope.group, paths: new Set(targets.map((target) => target.path))});
                break;
            }
            if (!reference.scopePath) invalid(entry.comment.path, `comment-from:${reference.name} has no allowed source in this structure.`);
        }
        for (const child of entry.children ?? []) resolveReferences(child, [entry, ...ancestors]);
    }
    resolveReferences(roots[0]);
    return roots[0];
}
