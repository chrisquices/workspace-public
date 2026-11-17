import {camelize, capitalize, isHTMLTag, isMathMLTag, isSVGTag} from '@vue/shared';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { resolveVueTemplateBinding } from '#eslint/helpers/resolve-vue-template-binding.js';

export const lucideSources = new Set(['@lucide/vue', 'lucide-vue-next']);
export const nonIconExports = new Set(['createLucideIcon', 'icons']);

// Resolve the actual template binding so aliased imports and namespaces work,
// while local components and scoped bindings with the same name stay distinct.
export function isImportedLucideIcon(node, sourceCode) {
    if (isHTMLTag(node.rawName) || isSVGTag(node.rawName) || isMathMLTag(node.rawName)) {
        return false;
    }

    const [tag, member, extra] = node.rawName.split('.');

    if (extra) {
        return false;
    }

    const normalized = camelize(tag);

    for (const name of new Set([tag, normalized, capitalize(normalized)])) {
        const variable = resolveVueTemplateBinding(name, node, sourceCode);

        if (!variable) {
            continue;
        }

        const binding = resolveImportOrigin(variable.identifiers?.[0], sourceCode);

        if (!lucideSources.has(binding?.source)) {
            return false;
        }

        if (member && binding.name !== '*') {
            return false;
        }

        const icon = member ?? binding.name;

        return icon !== '*' && icon !== 'default' && !nonIconExports.has(icon);
    }

    return false;
}
