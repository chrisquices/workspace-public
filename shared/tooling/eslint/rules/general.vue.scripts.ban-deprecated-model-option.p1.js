import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const allowedPropNames = new Set(["modelValue", "model-value"]);
const allowedEventNames = new Set(["update:modelValue", "update:model-value"]);
function findPropertyValue(node, key) {
    const property = node.properties.find((property) => property.type === "Property" && property.key.type === "Identifier" && property.key.name === key);
    return property?.type === "Property" && utils.isStringLiteral(property.value) ? property.value : void 0;
}
function replaceLiteral(fixer, node, text) {
    return fixer.replaceTextRange([node.range[0] + 1, node.range[1] - 1], text);
}

export default {
    meta: {
        type: "problem",
        description: 'Do not use the deprecated Vue model option; migrate props, events, and callers together.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecatedModel": "`model` definition is deprecated." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "vue3Compat": "`model` definition is deprecated. You may use the Vue 3-compatible `modelValue`/`update:modelValue` though." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "changeToModelValue": "Change to `modelValue`/`update:modelValue`." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "changeToKebabModelValue": "Change to `model-value`/`update:model-value`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowVue3Compat":false}];

        const shouldAllowVue3Compat = Boolean(ruleOptions[0]?.allowVue3Compat);
        return utils.executeOnVue(context, (obj) => {
            const modelProperty = utils.findProperty(obj, "model");
            if (!modelProperty || modelProperty.value.type !== "ObjectExpression") return;
            if (!shouldAllowVue3Compat) {
                context.report({
                    node: modelProperty,
                    messageId: "deprecatedModel"
                });
                return;
            }
            const propName = findPropertyValue(modelProperty.value, "prop");
            const eventName = findPropertyValue(modelProperty.value, "event");
            if (!propName || !eventName || !allowedPropNames.has(utils.getStringLiteralValue(propName, true) ?? "") || !allowedEventNames.has(utils.getStringLiteralValue(eventName, true) ?? "")) context.report({
                node: modelProperty,
                messageId: "vue3Compat"
            });
        });
    },
};
