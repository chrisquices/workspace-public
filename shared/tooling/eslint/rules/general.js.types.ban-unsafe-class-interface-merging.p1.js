import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-unsafe-declaration-merging.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'problem',
        description: 'Do not merge a class and an interface with the same name.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unsafeMerging": 'Unsafe declaration merging between classes and interfaces.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        function checkUnsafeDeclaration(scope, node, unsafeKind) {
            const variable = scope.set.get(node.name);
            if (!variable) {
                return;
            }
            const defs = variable.defs;
            if (defs.length <= 1) {
                return;
            }
            if (defs.some(def => def.node.type === unsafeKind)) {
                context.report({
                    node,
                    messageId: 'unsafeMerging'
                });
            }
        }
        return {
            ClassDeclaration(node) {
                if (node.id) {
                    // by default eslint returns the inner class scope for the ClassDeclaration node
                    // but we want the outer scope within which merged variables will sit
                    const currentScope = context.sourceCode.getScope(node).upper;
                    if (currentScope == null) {
                        return;
                    }
                    checkUnsafeDeclaration(currentScope, node.id, utils_1.AST_NODE_TYPES.TSInterfaceDeclaration);
                }
            },
            TSInterfaceDeclaration(node) {
                checkUnsafeDeclaration(context.sourceCode.getScope(node), node.id, utils_1.AST_NODE_TYPES.ClassDeclaration);
            },
        };
    },
};
