// A reactive domain must contain state or behavior when created. Empty object
// literals (including comment-only literals) are banned; methods count as content.
// Resolve Vue imports so aliases work and unrelated/shadowed reactive functions
// remain untouched. Unknown arguments and spreads are not assumed to be empty.
// Initialization and removal require domain knowledge, so this is report-only.

import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Do not initialize Vue reactive domains with empty object literals.',
        includeInReadme: true,
        schema: [],
        messages: {
            empty: 'This reactive domain is empty. Initialize it with the related state or methods it owns, or remove the placeholder if it is unnecessary. Preserve references and initialization order; do not add unrelated or dummy fields just to satisfy this rule.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        if (!document) return {};

        const scripts = document.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');

        return {
            CallExpression(node) {
                const argument = unwrapExpression(node.arguments[0]);
                if (argument?.type !== 'ObjectExpression' || argument.properties.length !== 0) return;

                const binding = resolveImportOrigin(node.callee, sourceCode);
                if (binding?.source !== 'vue' || binding.name !== 'reactive') return;
                if (!scripts.some((script) => script.startTag.range[1] <= node.range[0]
                    && node.range[1] <= (script.endTag?.range[0] ?? script.range[1]))) return;

                context.report({ node: argument, messageId: 'empty' });
            },
        };
    },
};
