import { camelize, capitalize, isHTMLTag, isMathMLTag, isSVGTag } from '@vue/shared';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { resolveVueTemplateBinding } from '#eslint/helpers/resolve-vue-template-binding.js';

export function createInertiaHeadVisitor(context, check) {
    const sourceCode = context.sourceCode;
    const services = sourceCode.parserServices;
    const template = sourceCode.ast.templateBody;
    const heads = [];

    if (!template || !services.defineTemplateBodyVisitor) {
        return {};
    }

    function isInertiaHead(node) {
        if (isHTMLTag(node.rawName) || isSVGTag(node.rawName) || isMathMLTag(node.rawName)) {
            return false;
        }

        const parts = node.rawName.split('.');

        if (parts.length > 2) {
            return false;
        }

        const camelized = camelize(parts[0]);
        const names = new Set([parts[0], camelized, capitalize(camelized)]);

        for (const name of names) {
            const variable = resolveVueTemplateBinding(name, node, sourceCode);

            if (!variable) {
                continue;
            }

            const imported = resolveImportOrigin(variable.identifiers?.[0], sourceCode);

            if (imported?.source !== '@inertiajs/vue3') {
                return false;
            }

            return parts.length === 1
                ? imported.name === 'Head'
                : imported.name === '*' && parts[1] === 'Head';
        }

        return node.rawName === 'Head';
    }

    // Collect all matches before checking them so relocation rules can preserve
    // ordering when several Head providers exist in the same template.
    return services.defineTemplateBodyVisitor({
        VElement(node) {
            if (isInertiaHead(node)) {
                heads.push(node);
            }
        },

        'VElement:exit'(node) {
            if (node === template) {
                for (const head of heads) {
                    check(head, template, heads);
                }
            }
        },
    });
}
