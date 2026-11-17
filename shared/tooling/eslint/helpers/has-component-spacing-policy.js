import { matchComponentStructure } from '#eslint/helpers/match-component-structure.js';
import { getComponentStructureEntry } from '#eslint/helpers/get-component-structure-entry.js';
import { walkComponentStructure } from '#eslint/helpers/walk-component-structure.js';

// Register at rule construction, before priority filtering, so general P3
// spacing can defer to explicit component policies from the UI P2 pass.
const spacingDefinitions = new Set();
const ownedParents = new WeakMap();

export function registerComponentSpacingPolicy(root) {
    spacingDefinitions.add(root);
}

export function hasComponentSpacingPolicy(sourceCode, parent) {
    if (!ownedParents.has(sourceCode)) {
        const parents = new WeakSet();
        const elements = [sourceCode.ast.templateBody].filter(Boolean);
        for (const element of elements) {
            elements.push(...element.children.filter((child) => child.type === 'VElement'));
            for (const root of spacingDefinitions) {
                const matchedEntry = getComponentStructureEntry(root, element, sourceCode);
                if (!matchedEntry) continue;
                for (const instance of walkComponentStructure(matchComponentStructure(matchedEntry, element, null, sourceCode))) {
                    const entry = instance.entry;
                    if (entry.blankLineBetweenChildren || entry.noBlankLineBetweenChildren
                        || ['single-liner', 'single-liner:unless-child-elements'].includes(entry.layout)) {
                        parents.add(instance.node);
                    }
                }
            }
        }
        ownedParents.set(sourceCode, parents);
    }
    return ownedParents.get(sourceCode).has(parent);
}
