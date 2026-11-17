import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-misused-new.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'problem',
        description: 'Avoid constructor signatures that return their own interface and class methods named new that return their own class.',
        includeInReadme: true,
        schema: [],
        messages: {
            "errorMessageClass": 'Class cannot have method named `new`.' + " Correct this violation while preserving comments, binding scope, and behavior.",
            "errorMessageInterface": 'Interfaces cannot be constructed, only classes.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        /**
         * @param node type to be inspected.
         * @returns name of simple type or null
         */
        function getTypeReferenceName(node) {
            if (node) {
                switch (node.type) {
                    case utils_1.AST_NODE_TYPES.TSTypeAnnotation:
                        return getTypeReferenceName(node.typeAnnotation);
                    case utils_1.AST_NODE_TYPES.TSTypeReference:
                        return getTypeReferenceName(node.typeName);
                    case utils_1.AST_NODE_TYPES.Identifier:
                        return node.name;
                    default:
                        break;
                }
            }
            return null;
        }
        /**
         * @param parent parent node.
         * @param returnType type to be compared
         */
        function isMatchingParentType(parent, returnType) {
            if (parent &&
                (parent.type === utils_1.AST_NODE_TYPES.ClassDeclaration ||
                    parent.type === utils_1.AST_NODE_TYPES.ClassExpression ||
                    parent.type === utils_1.AST_NODE_TYPES.TSInterfaceDeclaration) &&
                parent.id) {
                return getTypeReferenceName(returnType) === parent.id.name;
            }
            return false;
        }
        return {
            "ClassBody > MethodDefinition[key.name='new']"(node) {
                if (node.value.type === utils_1.AST_NODE_TYPES.TSEmptyBodyFunctionExpression &&
                    isMatchingParentType(node.parent.parent, node.value.returnType)) {
                    context.report({
                        node,
                        messageId: 'errorMessageClass'
                    });
                }
            },
            'TSInterfaceBody > TSConstructSignatureDeclaration'(node) {
                if (isMatchingParentType(node.parent.parent, node.returnType)) {
                    // constructor
                    context.report({
                        node,
                        messageId: 'errorMessageInterface'
                    });
                }
            },
            "TSMethodSignature[key.name='constructor']"(node) {
                context.report({
                    node,
                    messageId: 'errorMessageInterface'
                });
            },
        };
    },
};
