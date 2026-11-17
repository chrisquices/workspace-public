import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-this-alias.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'suggestion',
        description: 'Do not assign this to an alias; destructuring its properties is allowed.',
        includeInReadme: true,
        schema: [],
        messages: {
            "thisAssignment": "Unexpected aliasing of 'this' to local variable." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "thisDestructure": "Unexpected aliasing of members of 'this' to local variables." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowDestructuring":true,"allowedNames":[]}];
        const [{ allowDestructuring, allowedNames }] = ruleOptions;

        return {
            "VariableDeclarator[init.type='ThisExpression'], AssignmentExpression[right.type='ThisExpression']"(node) {
                const id = node.type === utils_1.AST_NODE_TYPES.VariableDeclarator ? node.id : node.left;
                if (allowDestructuring && id.type !== utils_1.AST_NODE_TYPES.Identifier) {
                    return;
                }
                const hasAllowedName = id.type === utils_1.AST_NODE_TYPES.Identifier
                    ? // https://github.com/typescript-eslint/typescript-eslint/issues/5439

                        allowedNames.includes(id.name)
                    : false;
                if (!hasAllowedName) {
                    context.report({
                        node: id,
                        messageId: id.type === utils_1.AST_NODE_TYPES.Identifier
                            ? 'thisAssignment'
                            : 'thisDestructure'
                    });
                }
            },
        };
    },
};
