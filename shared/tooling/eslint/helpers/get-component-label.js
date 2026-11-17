import { matchComponentStructure } from '#eslint/helpers/match-component-structure.js';
import { getComponentStructureEntry } from '#eslint/helpers/get-component-structure-entry.js';
import { walkComponentStructure } from '#eslint/helpers/walk-component-structure.js';
import { getVueAttributeBindings } from '#eslint/helpers/get-vue-attribute-bindings.js';
import { getComponentLabelContent } from '#eslint/helpers/get-component-label-content.js';

const definitions = new Set();
const labelsBySource = new WeakMap();

// Register before priority filtering so a parent component's comment-source can
// recognize an opted-in child even when only the parent's priority is running.
export function registerComponentLabels(root) {
    const entries = [root];
    for (const entry of entries) entries.push(...(entry.children ?? []));
    if (entries.some((entry) => entry.labelRequired)) definitions.add(root);
}

export function getComponentLabel(sourceCode, node) {
    if (!labelsBySource.has(sourceCode)) {
        const labels = new WeakMap();
        const nodes = [sourceCode.ast.templateBody].filter(Boolean);
        for (const element of nodes) {
            nodes.push(...element.children.filter((child) => child.type === 'VElement'));
            for (const root of definitions) {
                const entry = getComponentStructureEntry(root, element, sourceCode);
                if (!entry) continue;
                for (const instance of walkComponentStructure(matchComponentStructure(entry, element, null, sourceCode))) {
                    if (instance.entry.labelRequired) labels.set(instance.node, readLabel(sourceCode, instance.node));
                }
            }
        }
        labelsBySource.set(sourceCode, labels);
    }
    return labelsBySource.get(sourceCode).get(node);
}

function readLabel(sourceCode, node) {
    const span = getComponentLabelContent(node).children.find((child) => child.type === 'VElement' && child.rawName === 'span');
    const bindings = span && getVueAttributeBindings(sourceCode, span);
    const staticText = bindings && !bindings.uncertain
        && !span.startTag.attributes.some((attribute) => attribute.directive
            && ['if', 'else-if', 'else', 'for', 'show', 'slot', 'text', 'html', 'pre'].includes(attribute.key.name.name))
        && ![...bindings.attributes.keys()].some((name) => ['innerhtml', 'textcontent'].includes(name.toLowerCase()))
        && span.children.every((child) => child.type === 'VText');
    const text = staticText ? span.children.map((child) => child.value).join('').replace(/\s+/gu, ' ').trim() : undefined;
    return {node: span, text: text || undefined};
}
