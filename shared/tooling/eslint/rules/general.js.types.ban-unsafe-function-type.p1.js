import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-unsafe-function-type.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");
const util_1 = require("../util");

export default {
    meta: {
        type: 'problem',
        description: "Ban the global Function type in favor of explicit callable signatures.",
        includeInReadme: true,
        schema: [],
        messages: {
            "bannedFunctionType": [
                'The `Function` type accepts any function-like value.',
                'Prefer explicitly defining any function parameters and return type.',
            ].join('\n') + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        function checkBannedTypes(node) {
            if (node.type === utils_1.AST_NODE_TYPES.Identifier &&
                node.name === 'Function' &&
                (0, util_1.isReferenceToGlobalFunction)('Function', node, context.sourceCode)) {
                context.report({
                    node,
                    messageId: 'bannedFunctionType'
                });
            }
        }
        return {
            TSClassImplements(node) {
                checkBannedTypes(node.expression);
            },
            TSInterfaceHeritage(node) {
                checkBannedTypes(node.expression);
            },
            TSTypeReference(node) {
                checkBannedTypes(node.typeName);
            },
        };
    },
};
