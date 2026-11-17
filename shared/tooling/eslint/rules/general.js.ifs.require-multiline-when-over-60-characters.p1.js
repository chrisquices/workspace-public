import { createIfStatementFormatter } from '#eslint/helpers/create-if-statement-formatter.js';
import { isMultilineIfStatement } from '#eslint/helpers/is-multi-line-if-statement.js';

export default {
    meta: {
        type: 'layout',
        description: 'Expand single-line if chains over 60 characters, including indentation, into multiline braced branches.',
        includeInReadme: false,
        fixable: 'code',
        schema: [],
        messages: {
            length: 'This single-line if chain contains {{length}} characters including indentation, exceeding 60. Expand its branches into braced blocks with body code and closing braces on separate lines. Preserve conditions and if/else binding.',
            manual: 'Expand this long if chain manually. Preserve comments, line-sensitive directive targets, and the existing if/else binding while moving branches into multiline braced blocks.',
        },
    },

    create(context) {
        const layout = createIfStatementFormatter(context);

        return layout.visitor({
            IfStatement(node) {
                if (layout.chainRoot(node) !== node || isMultilineIfStatement(node)) {
                    return;
                }

                const length = layout.singleLineLength(node);

                if (length <= 60) {
                    return;
                }

                const edits = [];
                let safe = true;

                for (let current = node; current?.type === 'IfStatement'; current = current.alternate) {
                    for (const branch of layout.branches(current)) {
                        const planned = branch.type === 'BlockStatement'
                            ? layout.blockLineEdits(current, branch) : layout.wrapBranchEdits(current, branch);

                        if (planned === null) {
                            safe = false;
                        } else {
                            edits.push(...planned);
                        }
                    }
                }

                context.report({
                    node: node,
                    messageId: safe ? 'length' : 'manual',
                    data: { length: length },
                    fix(fixer) {
                        return safe ? layout.applyEdits(fixer, edits) : null;
                    },
                });
            },
        });
    },
};
