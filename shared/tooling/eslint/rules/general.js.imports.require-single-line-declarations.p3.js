const lineBreak = /[\r\n\u2028\u2029]/u;

export default {
    meta: {
        type: 'layout',
        description: 'Require every static import declaration, including TypeScript type and import-equals declarations, on one physical line regardless of length.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            singleLine: 'Collapse this entire import declaration to one physical line regardless of length. Preserve imported names, aliases, type modifiers, module specifiers, and import attributes.',
            manual: 'Keep this entire import declaration on one physical line. Move line or multiline comments above the import and rewrite multiline literals with equivalent escapes as needed, preserving import behavior.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        function checkImport(node) {
            if (node.loc.start.line === node.loc.end.line) {
                return;
            }

            const tokens = sourceCode.getTokens(node, { includeComments: true });
            const requiresManualFix = tokens.some((function (token) { return (token.type === 'Line' || lineBreak.test(sourceCode.getText(token))); }));

            context.report({
                node: node,
                messageId: requiresManualFix ? 'manual' : 'singleLine',
                fix(fixer) {
                    if (requiresManualFix) {
                        return null;
                    }

                    const fixes = [];

                    for (let index = 1; index < tokens.length; index++) {
                        const range = [tokens[index - 1].range[1], tokens[index].range[0]];

                        if (lineBreak.test(sourceCode.text.slice(...range))) {
                            fixes.push(fixer.replaceTextRange(range, ' '));
                        }
                    }

                    return fixes;
                },
            });
        }

        return {
            ImportDeclaration: checkImport,
            TSImportEqualsDeclaration: checkImport,
        };
    },
};
