import {isLineDirective} from '#eslint/helpers/is-line-directive.js';

// Compare complete top-level statements within each script setup block.
// Script tags are not statement boundaries, so no edge padding is inserted.
// Each owning rule supplies its target predicate and spacing/manual messages.
export function createVueScriptSpacingVisitor(context, isTarget) {
    const sourceCode = context.sourceCode;
    const document = sourceCode.parserServices.getDocumentFragment?.();
    if (!document) return {};

    const scripts = document.children.filter((node) => node.type === 'VElement' && node.rawName === 'script'
        && node.startTag.attributes.some((attribute) => !attribute.directive && attribute.key.name === 'setup'));
    if (!scripts.length) return {};

    const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
    const lineDirectives = sourceCode.getAllComments().filter(isLineDirective);

    return {
        Program(node) {
            for (const script of scripts) {
                const statements = node.body.filter((statement) => statement.type !== 'EmptyStatement'
                    && script.startTag.range[1] <= statement.range[0]
                    && statement.range[1] <= (script.endTag?.range[0] ?? script.range[1]));

                for (let index = 1; index < statements.length; index++) {
                    const previous = statements[index - 1];
                    const current = statements[index];
                    const currentTarget = isTarget(current);
                    if (!currentTarget && !isTarget(previous)) continue;

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
                        node: currentTarget ? current : previous,
                        messageId: safe ? 'spacing' : 'manual',
                        data: {position: currentTarget ? 'before' : 'after'},
                        fix(fixer) {
                            if (!safe) return null;
                            if (sameLine) {
                                const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                                const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                                return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                            }

                            const start = sourceCode.getIndexFromLoc({line: anchor.loc.start.line, column: 0});
                            return fixer.insertTextBeforeRange([start, start], newline);
                        },
                    });
                }
            }
        },
    };
}
