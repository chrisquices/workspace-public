import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const SLOT_USED_AS_VALUE_PARENT_TYPES = new Set([
    "MemberExpression",
    "VariableDeclarator",
    "SpreadElement",
    "ArrayExpression"
]);

export default {
    meta: {
        type: "problem",
        description: 'Invoke slot functions when using their rendered content.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Property in `$slots` should be used as function." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        /**
        * Verify the given node
        * @param node The node to verify
        * @param reportNode The node to report
        */
        function verify(node, reportNode) {
            const parent = node.parent;
            if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
                verifyReferences(parent.id, reportNode);
                return;
            }
            if (parent.type === "AssignmentExpression" && parent.right === node && parent.left.type === "Identifier") {
                verifyReferences(parent.left, reportNode);
                return;
            }
            if (parent.type === "ChainExpression") {
                verify(parent, reportNode);
                return;
            }
            if (SLOT_USED_AS_VALUE_PARENT_TYPES.has(parent.type)) context.report({
                node: reportNode,
                messageId: "unexpected"
            });
        }
        /**
        * Verify the references of the given node.
        * @param node The node to verify
        * @param reportNode The node to report
        */
        function verifyReferences(node, reportNode) {
            const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
            if (!variable) return;
            for (const reference of variable.references) {
                if (!reference.isRead()) continue;
                const id = reference.identifier;
                verify(id, reportNode);
            }
        }
        return utils.defineVueVisitor(context, { MemberExpression(node) {
            const object = utils.skipChainExpression(node.object);
            if (object.type !== "MemberExpression" || utils.getStaticPropertyName(object) !== "$slots" || !utils.isThis(object.object, context) || node.property.type === "PrivateIdentifier") return;
            verify(node, node.property);
        } });
    },
};
