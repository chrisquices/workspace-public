import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/triple-slash-reference.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'suggestion',
        description: 'Avoid triple-slash path references and type references that duplicate imports.',
        includeInReadme: true,
        schema: [],
        messages: {
            "tripleSlashReference": 'Do not use a triple slash reference for {{module}}, use `import` style instead.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"lib":"always","path":"never","types":"prefer-import"}];
        const [{ lib, path, types }] = ruleOptions;

        let programNode;
        const references = [];
        function hasMatchingReference(source) {
            references.forEach(reference => {
                if (reference.importName === source.value) {
                    context.report({
                        node: reference.comment,
                        data: {
                            module: reference.importName,
                        },
                        messageId: 'tripleSlashReference'
                    });
                }
            });
        }
        return {
            ImportDeclaration(node) {
                if (programNode) {
                    hasMatchingReference(node.source);
                }
            },
            Program(node) {
                if (lib === 'always' && path === 'always' && types === 'always') {
                    return;
                }
                programNode = node;
                const referenceRegExp = /^\/\s*<reference\s*(types|path|lib)\s*=\s*["|'](.*)["|']/;
                const firstToken = context.sourceCode.getFirstToken(programNode);
                const commentsBefore = firstToken
                    ? context.sourceCode.getCommentsBefore(firstToken)
                    : context.sourceCode.getAllComments();
                commentsBefore.forEach(comment => {
                    if (comment.type !== utils_1.AST_TOKEN_TYPES.Line) {
                        return;
                    }
                    const referenceResult = referenceRegExp.exec(comment.value);
                    if (referenceResult) {
                        if ((referenceResult[1] === 'types' && types === 'never') ||
                            (referenceResult[1] === 'path' && path === 'never') ||
                            (referenceResult[1] === 'lib' && lib === 'never')) {
                            context.report({
                                node: comment,
                                data: {
                                    module: referenceResult[2],
                                },
                                messageId: 'tripleSlashReference'
                            });
                            return;
                        }
                        if (referenceResult[1] === 'types' && types === 'prefer-import') {
                            references.push({ comment, importName: referenceResult[2] });
                        }
                    }
                });
            },
            TSImportEqualsDeclaration(node) {
                if (programNode) {
                    const reference = node.moduleReference;
                    if (reference.type === utils_1.AST_NODE_TYPES.TSExternalModuleReference) {
                        hasMatchingReference(reference.expression);
                    }
                }
            },
        };
    },
};
