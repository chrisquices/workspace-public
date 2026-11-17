// Separate top-level props type members without rewriting nested types. Keep
// leading documentation with its member and preserve physical-line directives.

import { getLineBreakEdits } from '#eslint/helpers/get-line-break-edits.js';
import { getInlinePropsType } from '#eslint/helpers/get-inline-props-type.js';
import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Put each top-level defineProps type member on its own line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            property: 'Start each top-level prop type member on its own line below the opening brace and after the preceding member. Keep nested prop types intact.',
            manual: 'Put this top-level prop type member on its own line manually. Keep its documentation attached, preserve nested types, and preserve the targets of ESLint or TypeScript line directives.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        return createVuePropsVisitor(context, {
            defineProps(node) {
                const type = getInlinePropsType(node);

                if (!type) {
                    return;
                }

                const declaration = getVariableDeclarator(node)?.parent ?? node;
                const indent = sourceCode.lines[declaration.loc.start.line - 1].match(/^[\t ]*/u)[0];
                let memberIndent = indent + (indent.includes('\t') ? '\t' : '    ');

                for (const member of type.members) {
                    const existing = sourceCode.lines[member.loc.start.line - 1].match(/^[\t ]*/u)[0];

                    if (member.loc.start.line > type.loc.start.line && existing.startsWith(indent) && existing.length > indent.length) {
                        memberIndent = existing;
                        break;
                    }
                }

                let previous = sourceCode.getFirstToken(type);

                for (const member of type.members) {
                    if (member.loc.start.line <= previous.loc.end.line) {
                        const anchor = sourceCode.getCommentsBefore(member).find(function (comment) {
                            return comment.range[0] >= previous.range[1]
                                && (previous.value === '{' || sourceCode.getText(comment).startsWith('/**'));
                        }) ?? member;
                        const first = sourceCode.getFirstToken(anchor) ?? anchor;
                        const edits = getLineBreakEdits(sourceCode, sourceCode.getTokenBefore(anchor, { includeComments: true }), first, newline + memberIndent);

                        context.report({
                            node: member,
                            messageId: edits ? 'property' : 'manual',
                            fix(fixer) {
                                return edits?.map(function (edit) {
                                    return fixer.replaceTextRange(edit.range, edit.text);
                                }) ?? null;
                            },
                        });
                    }

                    previous = member;
                }
            },
        });
    },
};
