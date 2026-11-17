import require_index from "eslint-plugin-vue/dist/utils/index.js";
import xml_name_validator from "xml-name-validator";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use valid attribute names on native Vue template elements.',
        includeInReadme: true,
        schema: [],
        messages: {
            "attribute": "Attribute name {{name}} is not valid." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const getName = (key) => typeof key === "string" ? key : key.name;
        return utils.defineTemplateBodyVisitor(context, { VAttribute(node) {
            if (utils.isCustomComponent(node.parent.parent)) return;
            const name = getName(node.key.name);
            if (name === "bind" && node.directive && node.key.argument && node.key.argument.type === "VIdentifier" && !xml_name_validator.name(node.key.argument.name)) context.report({
                node,
                data: { name: node.key.argument.name },
                messageId: "attribute"
            });
            if (!node.directive && !xml_name_validator.name(name)) context.report({
                node,
                data: { name },
                messageId: "attribute"
            });
        } });
    },
};
