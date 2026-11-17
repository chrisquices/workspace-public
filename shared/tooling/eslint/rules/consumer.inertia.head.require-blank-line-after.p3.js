import { createInertiaHeadVisitor } from '#eslint/helpers/create-inertia-head-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Put a blank line immediately after each Inertia Head component.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line immediately after the complete <{{name}}> component, following its closing tag when it has children. Preserve the component contents and the following markup\'s indentation.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        return createInertiaHeadVisitor(context, function (node) {
            const following = sourceCode.text.slice(node.range[1]);
            const whitespace = following.match(/^\s*/u)[0];
            const breaks = [...whitespace.matchAll(/\r\n|[\n\r\u2028\u2029]/gu)];

            if (breaks.length >= 2) {
                return;
            }

            context.report({
                node: node,
                messageId: 'spacing',
                data: { name: node.rawName },
                fix(fixer) {
                    if (breaks.length === 1) {
                        const end = node.range[1] + breaks[0].index + breaks[0][0].length;

                        return fixer.insertTextAfterRange([end, end], newline);
                    }

                    return fixer.insertTextAfter(node, newline + newline);
                },
            });
        });
    },
};
