export default {
    meta: {
        type: 'suggestion',
        description: 'Place variable declarations before function declarations within code regions.',
        includeInReadme: true,
        schema: [],
        messages: {
            order: 'Move this variable declaration above the functions in this region. Preserve initialization order and dependencies.',
        },
    },

    create(context) {
        function validateRegions(node) {
            const statements = node.body;
            const markers = context.sourceCode.getAllComments().filter(comment => {
                if (comment.type !== 'Line' || comment.range[0] < node.range[0] || comment.range[1] > node.range[1]) return false;
                if (!/^\s*(?:region|endregion)\b/.test(comment.value)) return false;

                // A region surrounding a function does not govern declarations inside its body.
                return !statements.some(statement => statement.range[0] <= comment.range[0] && comment.range[1] <= statement.range[1]);
            });
            const entries = [...markers, ...statements].sort((left, right) => left.range[0] - right.range[0]);
            const regions = [];

            for (const entry of entries) {
                if (entry.type === 'Line') {
                    if (/^\s*region\b/.test(entry.value)) {
                        regions.push({hasFunction: false});
                    } else {
                        regions.pop();
                    }
                    continue;
                }

                const region = regions.at(-1);
                if (!region) continue;

                const declaration = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(entry.type) ? entry.declaration : entry;
                if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'TSDeclareFunction') {
                    region.hasFunction = true;
                } else if (declaration?.type === 'VariableDeclaration' && region.hasFunction) {
                    context.report({node: declaration, messageId: 'order'});
                }
            }
        }

        return {
            Program: validateRegions,
            BlockStatement: validateRegions,
        };
    },
};
