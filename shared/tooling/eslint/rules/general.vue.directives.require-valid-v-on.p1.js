import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_key_aliases from "eslint-plugin-vue/dist/utils/key-aliases.js";
const utils = require_index.default;
const VALID_MODIFIERS = new Set([
    "stop",
    "prevent",
    "capture",
    "self",
    "ctrl",
    "shift",
    "alt",
    "meta",
    "native",
    "once",
    "left",
    "right",
    "middle",
    "passive",
    "esc",
    "tab",
    "enter",
    "space",
    "up",
    "down",
    "delete",
    "exact"
]);
const VERB_MODIFIERS = new Set(["stop", "prevent"]);
const KEY_ALIASES = new Set(require_key_aliases.default);
function isValidModifier(modifierNode, customModifiers) {
    const modifier = modifierNode.name;
    return VALID_MODIFIERS.has(modifier) || Number.isSafeInteger(Number.parseInt(modifier, 10)) || [...modifier].length === 1 || KEY_ALIASES.has(modifier) || customModifiers.has(modifier);
}

export default {
    meta: {
        type: "problem",
        description: 'Use valid v-on modifiers and provide a handler or a stop/prevent modifier.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unsupportedModifier": "'v-on' directives don't support the modifier '{{modifier}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "avoidKeyword": "Avoid using JavaScript keyword as \"v-on\" value: {{value}}." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValueOrVerb": "'v-on' directives require a value or verb modifier (like 'stop' or 'prevent')." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const options = ruleOptions[0] || {};
        const customModifiers = new Set(options.modifiers || []);
        const sourceCode = context.sourceCode;
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='on']"(node) {
            for (const modifier of node.key.modifiers) if (!isValidModifier(modifier, customModifiers)) context.report({
                node: modifier,
                data: { modifier: modifier.name },
                messageId: "unsupportedModifier"
            });
            if ((!node.value || !node.value.expression) && node.key.modifiers.every((modifier) => !VERB_MODIFIERS.has(modifier.name))) {
                if (node.value && !utils.isEmptyValueDirective(node, context)) {
                    const valueText = sourceCode.getText(node.value);
                    const innerText = (valueText[0] === "\"" || valueText[0] === "'") && valueText[0] === valueText.at(-1) ? valueText.slice(1, -1) : valueText;
                    if (/^\w+$/.test(innerText)) context.report({
                        node: node.value,
                        data: { value: valueText },
                        messageId: "avoidKeyword"
                    });
                } else context.report({
                    node,
                    messageId: "expectedValueOrVerb"
                });
            }
        } });
    },
};
