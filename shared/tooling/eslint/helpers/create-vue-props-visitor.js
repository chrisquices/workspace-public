import { getVuePropsMacroName } from './get-vue-props-macro-name.js';

export function createVuePropsVisitor(context, handlers) {
    const sourceCode = context.sourceCode;
    const document = sourceCode.parserServices.getDocumentFragment?.();
    const scripts = document?.children.filter(function (node) {
        return node.type === 'VElement' && node.rawName === 'script' && node.endTag
            && node.startTag.attributes.some(function (attribute) {
                return !attribute.directive && attribute.key.name === 'setup';
            });
    }) ?? [];

    if (scripts.length === 0) {
        return {};
    }

    return {
        CallExpression(node) {
            if (!scripts.some(function (script) {
                return script.startTag.range[1] <= node.range[0] && node.range[1] <= script.endTag.range[0];
            })) {
                return;
            }

            const name = getVuePropsMacroName(node.callee, sourceCode);

            if (name === 'withDefaults') {
                handlers.withDefaults?.(node);
                return;
            }

            if (name !== 'defineProps') {
                return;
            }

            handlers.defineProps?.(node);
        },
    };
}
