// Join a single identifier declaration through its inline props type opening.
// Keep destructuring, other declarators, and line-sensitive comments manual.

import { getLineBreakEdits } from '#eslint/helpers/get-line-break-edits.js';
import { getInlinePropsType } from '#eslint/helpers/get-inline-props-type.js';
import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Keep the props declaration through its opening type brace on one line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            opening: 'Put the variable declaration, defineProps call, and opening type brace on the same line, as in const props = defineProps<{. Preserve comments when adjusting the layout.',
            manual: 'Put this declaration through its opening type brace on one line manually. Preserve destructuring, other declarators, comments, multiline literals, and the targets of ESLint or TypeScript line directives.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return createVuePropsVisitor(context, {
            defineProps(node) {
                const statement = getVariableDeclarator(node)?.parent;
                const type = getInlinePropsType(node);

                if (statement && type && statement.loc.start.line !== type.loc.start.line) {
                    const simple = statement.type === 'VariableDeclaration' && statement.declarations.length === 1
                        && statement.declarations[0].id.type === 'Identifier';
                    const edits = simple
                        ? getLineBreakEdits(sourceCode, sourceCode.getFirstToken(statement), sourceCode.getFirstToken(type), ' ') : null;

                    context.report({
                        node: node,
                        messageId: edits ? 'opening' : 'manual',
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
