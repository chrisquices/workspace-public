// Join only the closing delimiters of a typed defineProps call without runtime
// arguments. Preserve comments and leave line-sensitive layouts for manual fixes.

import { getLineBreakEdits } from '#eslint/helpers/get-line-break-edits.js';
import { getInlinePropsType } from '#eslint/helpers/get-inline-props-type.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Keep the defineProps type closing brace and call delimiters on the same line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            closing: 'Put the type closing brace and the defineProps call closing delimiters on the same line, as in }>();. Preserve comments when adjusting the layout.',
            manual: 'Join the type closing brace and call closing delimiters manually. Preserve runtime arguments, line comments, multiline comments or literals, and the targets of ESLint or TypeScript line directives.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return createVuePropsVisitor(context, {
            defineProps(node) {
                const type = getInlinePropsType(node);

                if (type && type.loc.end.line !== node.loc.end.line) {
                    const edits = node.arguments.length === 0
                        ? getLineBreakEdits(sourceCode, sourceCode.getLastToken(type), sourceCode.getLastToken(node), '') : null;

                    context.report({
                        node: node,
                        messageId: edits ? 'closing' : 'manual',
                        fix(fixer) {
                            return edits?.map(function (edit) {
                                return fixer.replaceTextRange(edit.range, edit.text);
                            }) ?? null;
                        },
                    });
                }
            },
        });
    },
};
