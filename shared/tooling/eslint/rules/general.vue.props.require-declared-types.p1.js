import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Declare types or validators for runtime Vue props and models.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireType": "Prop \"{{name}}\" should define at least its type." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        function optionHasType(node) {
            switch (node.type) {
                case "ObjectExpression": return objectHasType(node);
                case "ArrayExpression": return node.elements.length > 0;
                case "FunctionExpression":
                case "ArrowFunctionExpression": return false;
            }
            return null;
        }
        function objectHasType(node) {
            const typeProperty = node.properties.find((p) => p.type === "Property" && utils.getStaticPropertyName(p) === "type" && (p.value.type !== "ArrayExpression" || p.value.elements.length > 0));
            const validatorProperty = node.properties.find((p) => p.type === "Property" && utils.getStaticPropertyName(p) === "validator");
            return Boolean(typeProperty || validatorProperty);
        }
        function checkProperty(prop) {
            if (prop.type !== "object" && prop.type !== "array") return;
            if (prop.type !== "array" && (optionHasType(prop.value) ?? true)) return;
            const { node, propName } = prop;
            const name = propName || node.type === "Identifier" && node.name || "Unknown prop";
            context.report({
                node,
                data: { name },
                messageId: "requireType"
            });
        }
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, {
            onDefinePropsEnter(_node, props) {
                for (const prop of props) checkProperty(prop);
            },
            onDefineModelEnter(node, model) {
                if (model.typeNode || model.options && (optionHasType(model.options) ?? true)) return;
                context.report({
                    node: model.options || node,
                    data: { name: model.name.modelName },
                    messageId: "requireType"
                });
            }
        }), utils.executeOnVue(context, (obj) => {
            const props = utils.getComponentPropsFromOptions(obj);
            for (const prop of props) checkProperty(prop);
        }));
    },
};
