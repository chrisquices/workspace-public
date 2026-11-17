import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Return a value from computed getters.',
        includeInReadme: true,
        schema: [],
        messages: {
            "expectedReturnInFunction": "Expected to return a value in computed function." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedReturnInProperty": "Expected to return a value in \"{{name}}\" computed property." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"treatUndefinedAsUnspecified":true}];

        const shouldTreatUndefinedAsUnspecified = (ruleOptions[0] || {}).treatUndefinedAsUnspecified !== false;
        const computedProperties = new Set();
        const computedFunctionNodes = [];
        return Object.assign({ Program(program) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, program));
            const map = { computed: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true } };
            for (const { node } of utils.iterateReferencesTraceMap(tracker, map)) {
                if (node.type !== "CallExpression") continue;
                const getter = utils.getGetterBodyFromComputedFunction(node);
                if (getter) computedFunctionNodes.push(getter);
            }
        } }, utils.defineVueVisitor(context, { onVueObjectEnter(obj) {
            for (const computedProperty of utils.getComputedProperties(obj)) computedProperties.add(computedProperty);
        } }), utils.executeOnFunctionsWithoutReturn(context, shouldTreatUndefinedAsUnspecified, (node) => {
            for (const cp of computedProperties) if (cp.value && cp.value.parent === node) context.report({
                node,
                data: { name: cp.key || "Unknown" },
                messageId: "expectedReturnInProperty"
            });
            for (const cf of computedFunctionNodes) if (cf === node) context.report({
                node,
                messageId: "expectedReturnInFunction"
            });
        }));
    },
};
