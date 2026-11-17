import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-namespace.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");
const util_1 = require("../util");

export default {
    meta: {
        type: 'suggestion',
        description: 'Use ES modules instead of TypeScript namespaces outside declaration files.',
        includeInReadme: true,
        schema: [],
        messages: {
            "moduleSyntaxIsPreferred": 'ES2015 module syntax is preferred over namespaces.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowDeclarations":false,"allowDefinitionFiles":true}];
        const [{ allowDeclarations, allowDefinitionFiles }] = ruleOptions;

        function isDeclaration(node) {
            if (node.type === utils_1.AST_NODE_TYPES.TSModuleDeclaration && node.declare) {
                return true;
            }
            return node.parent != null && isDeclaration(node.parent);
        }
        return {
            "TSModuleDeclaration[global!=true][id.type!='Literal']"(node) {
                if (node.parent.type === utils_1.AST_NODE_TYPES.TSModuleDeclaration ||
                    (allowDefinitionFiles && (0, util_1.isDefinitionFile)(context.filename)) ||
                    (allowDeclarations && isDeclaration(node))) {
                    return;
                }
                context.report({
                    node,
                    messageId: 'moduleSyntaxIsPreferred'
                });
            },
        };
    },
};
