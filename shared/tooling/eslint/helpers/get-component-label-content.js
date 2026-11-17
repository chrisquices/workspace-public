import { hasAsChild } from '#eslint/helpers/match-component-structure.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

export function getComponentLabelContent(node) {
    if (!matchesVueComponentName(node, 'Caption') || !hasAsChild(node)) return node;

    const children = node.children.filter((child) => child.type !== 'VComment' && child.type !== 'VHTMLComment'
        && !(child.type === 'VText' && !child.value.trim()));
    return children.length === 1 && children[0].type === 'VElement' ? children[0] : node;
}
