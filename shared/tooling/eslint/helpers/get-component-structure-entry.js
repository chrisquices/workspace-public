import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import { getVueTemplateRoot } from '#eslint/helpers/get-vue-template-root.js';

// A partial's single root can own a declared subtree when that declaration is
// unambiguous. Caller-owned comments/placement do not move into the definition.
export function getComponentStructureEntry(root, node, sourceCode) {
    if (matchesVueComponentName(node, root.name)) return root;
    if (!sourceCode || node !== getVueTemplateRoot(sourceCode)) return undefined;
    const entries = [...(root.children ?? [])];
    for (const entry of entries) entries.push(...(entry.children ?? []));
    const matches = entries.filter((entry) => !entry.special && !entry.group && !entry.forbidden
        && matchesVueComponentName(node, entry.name));
    if (matches.length !== 1) return undefined;
    if (!matches[0].name.startsWith(root.name)) {
        const familyEntries = [];
        const pendingEntries = [...(matches[0].children ?? [])];
        for (const entry of pendingEntries) {
            if (!entry.group && !entry.special && entry.name.startsWith(root.name)) familyEntries.push(entry);
            pendingEntries.push(...(entry.children ?? []));
        }
        const pendingNodes = [...node.children];
        let found = false;
        for (const child of pendingNodes) {
            if (child.type !== 'VElement') continue;
            if (familyEntries.some((entry) => matchesVueComponentName(child, entry.name))) {
                found = true;
                break;
            }
            pendingNodes.push(...child.children);
        }
        if (!found) return undefined;
    }
    return {...matches[0], comment: undefined, firstInParent: false, blankLine: undefined, blankLineAfter: undefined};
}
