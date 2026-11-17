// Component behavior belongs with the reactive domain that owns it. Name the
// object for its subject and methods for actions without repeating that subject:
// selectedItems.clear(), not selectedItems.clearSelectedItems(). Domain and
// English naming choices need human judgment; this rule only detects placement.
// Server actions belong to useInertiaHelperForm, named by action and subject.
// Imported functions, nested helpers, callbacks, and object methods are allowed.
// Function-valued top-level variables are owned by the reactive-storage rule.
// Moving functions is manual because hoisting, initialization, and this can change.

import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Place Vue script functions in the reactive domain that owns their behavior.',
        includeInReadme: true,
        schema: [],
        messages: {
            placement: 'Move this top-level function into the domain that owns its behavior. Keep related state and methods together; use a clear subject name and concise method names, such as selectedItems.clear(), without repeating the subject. Server actions belong to useInertiaHelperForm objects named by action and subject. Update references manually, preserving hoisting, initialization order, and this behavior.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        if (!document) return {};

        const scripts = document.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');

        return {
            Program(node) {
                for (const statement of node.body) {
                    const declaration = unwrapExpression(['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(statement.type)
                        ? statement.declaration : statement);
                    if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'TSDeclareFunction'].includes(declaration?.type)) continue;

                    const script = scripts.find((element) => element.startTag.range[1] <= statement.range[0]
                        && statement.range[1] <= (element.endTag?.range[0] ?? element.range[1]));
                    if (!script) continue;

                    context.report({ node: declaration.id ?? declaration, messageId: 'placement' });
                }
            },
        };
    },
};
