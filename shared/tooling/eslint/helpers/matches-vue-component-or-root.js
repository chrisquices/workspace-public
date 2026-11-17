import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import { getImportedVueComponentRoots } from '#eslint/helpers/get-imported-vue-component-roots.js';

export function matchesVueComponentOrRoot(node, name, sourceCode) {
    return matchesVueComponentName(node, name) || (sourceCode && getImportedVueComponentRoots(sourceCode, node)
        .some((rawName) => matchesVueComponentName({type: 'VElement', rawName}, name)));
}
