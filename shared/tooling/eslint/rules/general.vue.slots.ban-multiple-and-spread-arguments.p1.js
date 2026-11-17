import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Call slot functions with at most one explicit props argument.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Unexpected multiple arguments." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpread": "Unexpected spread argument." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        /**
        * Verify the given node
        */
        function verify(node) {
            const parent = node.parent;
            if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
                verifyReferences(parent.id);
                return;
            }
            if (parent.type === "AssignmentExpression" && parent.right === node && parent.left.type === "Identifier") {
                verifyReferences(parent.left);
                return;
            }
            if (parent.type !== "CallExpression" || parent.arguments.includes(node) || parent.arguments.length === 0) return;
            if (parent.arguments.length > 1) context.report({
                node: parent.arguments[1],
                messageId: "unexpected"
            });
            if (parent.arguments[0].type === "SpreadElement") context.report({
                node: parent.arguments[0],
                messageId: "unexpectedSpread"
            });
        }
        /**
        * Verify the references of the given node.
        */
        function verifyReferences(node) {
            const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
            if (!variable) return;
            for (const reference of variable.references) {
                if (!reference.isRead()) continue;
                const id = reference.identifier;
                verify(id);
            }
        }
        return utils.defineVueVisitor(context, { MemberExpression(node) {
            const object = utils.skipChainExpression(node.object);
            if (object.type !== "MemberExpression") return;
            const name = utils.getStaticPropertyName(object);
            if (name && (name === "$slots" || name === "$scopedSlots") && utils.isThis(object.object, context)) verify(node);
        } });
    },
};
