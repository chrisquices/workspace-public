// Put the inline type's closing brace below its members, including empty types.
// Change only boundary whitespace and preserve comments and line directives.

import { getLineBreakEdits } from '#eslint/helpers/get-line-break-edits.js';
import { getInlinePropsType } from '#eslint/helpers/get-inline-props-type.js';
import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Put the defineProps type closing brace on a separate line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            closingBrace: 'Move the inline props type closing brace to a line after the last member. Empty types also need their closing brace below the opening brace.',
            manual: 'Put this props type closing brace on a separate line manually. Preserve trailing comments and the targets of ESLint or TypeScript line directives.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        return createVuePropsVisitor(context, {
            defineProps(node) {
                const type = getInlinePropsType(node);

                if (type && type.loc.end.line <= (type.members.at(-1)?.loc.end.line ?? type.loc.start.line)) {
                    const declaration = getVariableDeclarator(node)?.parent ?? node;
                    const indent = sourceCode.lines[declaration.loc.start.line - 1].match(/^[\t ]*/u)[0];
                    const close = sourceCode.getLastToken(type);
                    const edits = getLineBreakEdits(sourceCode, sourceCode.getTokenBefore(close, { includeComments: true }), close, newline + indent);

                    context.report({
                        node: type,
                        messageId: edits ? 'closingBrace' : 'manual',
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
