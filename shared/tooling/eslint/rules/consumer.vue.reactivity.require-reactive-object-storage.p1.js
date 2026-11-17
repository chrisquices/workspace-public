// Component-level storage belongs in reactive() objects organized by a coherent
// feature or responsibility: selection, detailsSidebar, newFolder, preferences.
// Related fields and methods share an owner; unrelated page state must not be dumped into
// one generic object. A domain can have one field; do not force artificial groups.
// Domain boundaries require human judgment and are guidance, not AST detection.
// Use English subject names and omit that subject from methods: selectedItems.clear(),
// not selectedItems.clearSelectedItems(). Standalone server actions use
// useInertiaHelperForm, named by action and subject, such as deleteSelectedItems.
// Function/loop locals and imports are outside this rule. Exceptions require recognizable initializers;
// this is a syntax rule, not a TypeScript type-checker. Moving storage and its
// references is intentionally manual. Single HTML element and component template refs
// may stand alone. Script setup props and defineEmits declarations are also exempt.
// Reuse the installed Vue tag list and component detection.

import htmlElements from 'eslint-plugin-vue/dist/utils/html-elements.js';
import vueUtils from 'eslint-plugin-vue/dist/utils/index.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { getVuePropsMacroName } from '#eslint/helpers/get-vue-props-macro-name.js';

const htmlTags = new Set(htmlElements.default);
const utils = vueUtils.default;

function htmlType(type, sourceCode) {
    if (type?.type === 'TSUnionType') {
        const members = type.types.filter((member) => !['TSNullKeyword', 'TSUndefinedKeyword'].includes(member.type)
            && !(member.type === 'TSLiteralType' && member.literal.type === 'Literal' && member.literal.value === null));
        return members.length > 0 && members.every((member) => htmlType(member, sourceCode));
    }

    return type?.type === 'TSTypeReference' && type.typeName.type === 'Identifier'
        && /^HTML(?:[A-Z][A-Za-z]*)?Element$/u.test(type.typeName.name)
        && !resolveVariableBinding(type.typeName, sourceCode)?.defs.length;
}

function htmlQuery(node, sourceCode) {
    const call = unwrapExpression(node);
    const callee = unwrapExpression(call?.callee);

    if (call?.type !== 'CallExpression' || callee?.type !== 'MemberExpression') return false;

    const owner = unwrapExpression(callee.object);
    if (owner?.type !== 'Identifier' || owner.name !== 'document' || resolveVariableBinding(owner, sourceCode)?.defs.length) return false;

    const method = getStaticPropertyName(callee);
    if (method === 'getElementById') return true;
    if (!['createElement', 'querySelector'].includes(method)) return false;

    const argument = call.arguments[0];
    return (argument?.type === 'Literal' && htmlTags.has(argument.value))
        || (method === 'querySelector' && htmlType(call.typeArguments?.params[0], sourceCode));
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Organize component storage in reactive objects by responsibility; single element and component refs may stand alone.',
        includeInReadme: true,
        schema: [],
        messages: {
            storage: 'Move {{name}} into a reactive() object named for its feature or responsibility, such as selectedItems, detailsSidebar, newFolder, or preferences. Group related state and methods under a clear owner; do not collect unrelated page state in one generic state object. Omit the subject from method names: selectedItems.clear(), not selectedItems.clearSelectedItems(). A group may contain one field. Choose boundaries and update references manually, preserving initialization order and ref-dependent behavior. Standalone exceptions: useInertiaHelperForm objects for server actions, computed values, props declarations, defineEmits declarations, HTML element references, and single component template refs.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        if (!document) return {};

        const scripts = document.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const templateRefs = new Map();

        function collectRefs(element, repeated = false) {
            if (element.type !== 'VElement') return;

            const attributes = element.startTag.attributes;
            const inLoop = repeated || attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'for');
            const native = element.namespace === 'http://www.w3.org/1999/xhtml' && htmlTags.has(element.rawName)
                && !attributes.some((attribute) => (!attribute.directive && attribute.key.name === 'is')
                    || (attribute.directive && (attribute.key.name.name === 'is'
                        || (attribute.key.name.name === 'bind' && (!attribute.key.argument || attribute.key.argument.name === 'is')))));
            const component = utils.isCustomComponent(element);

            for (const attribute of attributes) {
                if (attribute.directive || attribute.key.name !== 'ref' || !attribute.value) continue;
                const name = attribute.value.value;
                templateRefs.set(name, (templateRefs.get(name) ?? true) && (native || component) && !inLoop);
            }

            for (const child of element.children) collectRefs(child, inLoop);
        }

        for (const element of document.children) {
            if (element.type === 'VElement' && element.rawName === 'template') collectRefs(element);
        }

        function allowed(declaration, script) {
            if (declaration.id.type !== 'Identifier') return false;

            const init = unwrapExpression(declaration.init);
            if (htmlQuery(init, sourceCode)) return true;
            if (init?.type !== 'CallExpression') return false;

            const binding = resolveImportOrigin(init.callee, sourceCode);
            if (binding?.source === 'workspace-packages/inertia-helper' && binding.name === 'useInertiaHelperForm') return true;

            if (binding?.source === 'vue') {
                if (['reactive', 'computed'].includes(binding.name)) return true;

                if (['ref', 'shallowRef', 'useTemplateRef'].includes(binding.name)) {
                    const name = binding.name === 'useTemplateRef' ? init.arguments[0]?.value : declaration.id.name;
                    // The template establishes a single element/component target;
                    // an annotation cannot override a repeated or unsupported target.
                    if (templateRefs.has(name)) return templateRefs.get(name);
                    return htmlType(init.typeArguments?.params[0], sourceCode)
                        || (binding.name !== 'useTemplateRef' && htmlQuery(init.arguments[0], sourceCode));
                }
            }

            if (!script.startTag.attributes.some((attribute) => !attribute.directive && attribute.key.name === 'setup')) return false;

            const callee = unwrapExpression(init.callee);
            if (!init.optional && ((callee?.type === 'Identifier' && callee.name === 'defineEmits'
                && !resolveVariableBinding(callee, sourceCode)?.defs.length)
                || (binding?.source === 'vue' && binding.name === 'defineEmits'))) return true;

            const macro = getVuePropsMacroName(init.callee, sourceCode);
            if (macro === 'defineProps') return true;
            const argument = unwrapExpression(init.arguments[0]);
            return macro === 'withDefaults' && argument?.type === 'CallExpression'
                && getVuePropsMacroName(argument.callee, sourceCode) === 'defineProps';
        }

        return {
            VariableDeclaration(node) {
                const parent = node.parent.type === 'ExportNamedDeclaration' ? node.parent.parent : node.parent;
                if (parent.type !== 'Program') return;

                const script = scripts.find((element) => element.startTag.range[1] <= node.range[0]
                    && node.range[1] <= (element.endTag?.range[0] ?? element.range[1]));
                if (!script) return;

                for (const declaration of node.declarations) {
                    if (allowed(declaration, script)) continue;
                    context.report({
                        node: declaration.id,
                        messageId: 'storage',
                        data: { name: sourceCode.getText(declaration.id) },
                    });
                }
            },
        };
    },
};
