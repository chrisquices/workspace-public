// Multiline if chains use braced branches. Short single-line chains omit braces
// only for one simple statement; otherwise expand without changing block scope.
// Long single-line chains remain owned by the existing 60-character rule.
import { createIfStatementFormatter } from '#eslint/helpers/create-if-statement-formatter.js';
import { isMultilineIfStatement } from '#eslint/helpers/is-multi-line-if-statement.js';
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';

const removableStatements = new Set([
    'ExpressionStatement', 'ReturnStatement', 'ThrowStatement',
    'BreakStatement', 'ContinueStatement', 'DebuggerStatement', 'EmptyStatement',
]);

export default {
    meta: {
        type: 'layout',
        description: 'Require braces for multiline if branches and safely omit braces from short single-line if branches.',
        includeInReadme: false,
        schema: [],
        fixable: 'code',
        messages: {
            braces: 'Use braced blocks with separate body and closing-brace lines for this multiline if chain. Preserve scope and if/else binding.',
            inline: 'Remove unnecessary braces from this single-line if chain while preserving its statement and if/else binding.',
            expand: 'Expand this if chain into multiline braced blocks because removing braces could change scope, statement grouping, or if/else binding.',
            manual: 'Correct this if chain’s braces and layout manually, preserving comments, directive targets, scope, and if/else binding.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const layout = createIfStatementFormatter(context);

        return layout.visitor({
            IfStatement(node) {
                if (layout.chainRoot(node) !== node) return;
                const multiline = isMultilineIfStatement(node);
                if (!multiline && layout.singleLineLength(node) > 60) return;
                const branches = [];
                for (let current = node; current?.type === 'IfStatement'; current = current.alternate) {
                    for (const branch of layout.branches(current)) branches.push({owner: current, branch});
                }
                const blocks = branches.filter(({branch}) => branch.type === 'BlockStatement');
                if (!multiline && !blocks.length) return;

                const canRemove = !multiline && blocks.every(({branch}) => branch.body.length === 1
                    && removableStatements.has(branch.body[0].type)
                    && layout.tokensFor(branch).getCommentsInside(branch).length === 0);
                const edits = [];
                let safe = true;
                const tokens = layout.tokensFor(node);
                const sensitive = [
                    ...tokens.getCommentsInside(node),
                    ...tokens.getCommentsBefore(node).filter((comment) => comment.loc.end.line >= node.loc.start.line - 1),
                    ...tokens.getCommentsAfter(node).filter((comment) => comment.loc.start.line === node.loc.end.line),
                ].some(isLineDirective);

                if (canRemove) {
                    safe = !sensitive;
                    for (const {branch} of blocks) {
                        const store = layout.tokensFor(branch);
                        const header = store.getTokenBefore(branch);
                        const gap = sourceCode.text.slice(header.range[1], branch.range[0]);
                        if (gap.trim()) safe = false;
                        let statement = sourceCode.getText(branch.body[0]);
                        // A closing brace can supply ASI; retain that separator
                        // explicitly before removing the block.
                        if (!statement.endsWith(';')) statement += ';';
                        const next = store.getTokenAfter(branch, {includeComments: true});
                        const separator = next?.value === 'else' && next.range[0] === branch.range[1] ? ' ' : '';
                        edits.push({range: [header.range[1], branch.range[1]], text: ` ${statement}${separator}`});
                    }
                } else {
                    for (const {owner, branch} of branches) {
                        const planned = branch.type === 'BlockStatement'
                            ? layout.blockLineEdits(owner, branch) : layout.wrapBranchEdits(owner, branch);
                        if (planned === null) safe = false;
                        else edits.push(...planned);
                    }
                    if (!edits.length && safe) return;
                }

                context.report({
                    node,
                    messageId: !safe ? 'manual' : canRemove ? 'inline' : multiline ? 'braces' : 'expand',
                    fix: safe ? (fixer) => layout.applyEdits(fixer, edits) : undefined,
                });
            },
        });
    },
};
