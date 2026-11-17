// Separate direct reactive-object members when either neighbor spans lines.
// Resolve Vue imports, including aliases, rather than matching callee spelling.
// Single-line fields remain grouped. Nested objects count as whole members;
// their own fields are not recursively spaced unless wrapped in reactive().
// Follow existing function/variable spacing conventions for attached comments
// and line directives. Never add padding against the object's enclosing braces.

import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Require a blank line between direct Vue reactive object members when either neighboring member spans multiple lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Separate this reactive object member from its neighbor with a blank line because at least one spans multiple lines. Keep single-line fields grouped and comments attached; do not add padding against the enclosing braces.',
            manual: 'Separate these reactive object members with a blank line manually, preserving line-sensitive directives and their targets.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
        const lineDirectives = sourceCode.getAllComments().filter(isLineDirective);

        return {
            CallExpression(node) {
                const object = unwrapExpression(node.arguments[0]);
                if (object?.type !== 'ObjectExpression') return;

                const binding = resolveImportOrigin(node.callee, sourceCode);
                if (binding?.source !== 'vue' || binding.name !== 'reactive') return;

                for (let index = 1; index < object.properties.length; index++) {
                    const previous = object.properties[index - 1];
                    const current = object.properties[index];
                    if (previous.loc.start.line === previous.loc.end.line
                        && current.loc.start.line === current.loc.end.line) continue;

                    const comments = sourceCode.getCommentsBefore(current).filter((comment) => comment.range[0] >= previous.range[1]);
                    const boundaries = [previous, ...comments, current];
                    const separated = boundaries.slice(1).some((next, position) => sourceCode.lines
                        .slice(boundaries[position].loc.end.line, next.loc.start.line - 1)
                        .some((line) => line.trim() === ''));
                    if (separated) continue;

                    const anchor = comments.find((comment) => comment.loc.start.line > previous.loc.end.line
                        || (comment.type === 'Block' && sourceCode.getText(comment).startsWith('/**'))) ?? current;
                    const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];
                    const sameLine = anchor.loc.start.line === beforeAnchor.loc.end.line;
                    const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment))
                        && !(sameLine && lineDirectives.some((comment) => comment.loc.start.line <= anchor.loc.start.line
                            && comment.loc.end.line + 1 >= anchor.loc.start.line));

                    context.report({
                        node: current,
                        messageId: safe ? 'spacing' : 'manual',
                        fix(fixer) {
                            if (!safe) return null;
                            if (sameLine) {
                                const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                                const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                                return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                            }

                            const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });
                            return fixer.insertTextBeforeRange([start, start], newline);
                        },
                    });
                }
            },
        };
    },
};
