import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use deprecated Vue instance event bus methods $on, $off, or $once.',
        includeInReadme: true,
        schema: [],
        messages: {
            "noDeprecatedEventsApi": "The Events api `$on`, `$off` `$once` is deprecated. Using external library instead, for example mitt." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineVueVisitor(context, { "CallExpression > MemberExpression, CallExpression > ChainExpression > MemberExpression"(node) {
            const call = node.parent.type === "ChainExpression" ? node.parent.parent : node.parent;
            if (call.optional || utils.skipChainExpression(call.callee) !== node || ![
                "$on",
                "$off",
                "$once"
            ].includes(utils.getStaticPropertyName(node) || "") || !utils.isThis(node.object, context)) return;
            context.report({
                node: node.property,
                messageId: "noDeprecatedEventsApi"
            });
        } });
    },
};
