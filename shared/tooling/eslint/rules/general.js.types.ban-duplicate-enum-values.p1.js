import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-duplicate-enum-values.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'problem',
        description: 'Do not assign duplicate explicit values to enum members.',
        includeInReadme: true,
        schema: [],
        messages: {
            "duplicateValue": "Duplicate enum value {{value}}. Verify whether it is intentional and preserve existing API references. If the intended value is unclear, ask the developer."
        },
    },
    create(context) {

        function isStringLiteral(node) {
            return (node.type === utils_1.AST_NODE_TYPES.Literal && typeof node.value === 'string');
        }
        function isNumberLiteral(node) {
            return (node.type === utils_1.AST_NODE_TYPES.Literal && typeof node.value === 'number');
        }
        function isSupportedUnary(node) {
            return (node.type === utils_1.AST_NODE_TYPES.UnaryExpression &&
                ['-', '+'].includes(node.operator));
        }
        function isStaticTemplateLiteral(node) {
            return (node.type === utils_1.AST_NODE_TYPES.TemplateLiteral &&
                node.expressions.length === 0 &&
                node.quasis.length === 1);
        }
        function getMemberValue(initializer) {
            switch (true) {
                case isStringLiteral(initializer):
                case isNumberLiteral(initializer):
                    return initializer.value;
                case isSupportedUnary(initializer): {
                    const inner = Number(getMemberValue(initializer.argument));
                    if (Number.isNaN(inner)) {
                        return undefined;
                    }
                    return initializer.operator === '-' ? -inner : inner;
                }
                case isStaticTemplateLiteral(initializer):
                    return initializer.quasis[0].value.cooked ?? undefined;
                default:
                    return undefined;
            }
        }
        return {
            TSEnumDeclaration(node) {
                const enumMembers = node.body.members;
                const seenValues = [];
                enumMembers.forEach(member => {
                    if (member.initializer == null) {
                        return;
                    }
                    const value = getMemberValue(member.initializer);
                    if (value == null) {
                        return;
                    }
                    const isAlreadyPresent = seenValues.some(seenValue => Object.is(seenValue, value));
                    if (isAlreadyPresent) {
                        context.report({
                            node: member,
                            data: {
                                value,
                            },
                            messageId: 'duplicateValue'
                        });
                    }
                    else {
                        seenValues.push(value);
                    }
                });
            },
        };
    },
};
