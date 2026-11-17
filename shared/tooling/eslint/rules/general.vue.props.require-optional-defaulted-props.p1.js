import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Make props with default values optional.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireOptional": `Prop "{{ key }}" should be optional.` + " Correct this violation while preserving comments, binding scope, and behavior.",
            "fixRequiredProp": `Change this prop to be optional.` + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"autofix":false}];

        let canAutoFix = false;
        const option = ruleOptions[0];
        if (option) canAutoFix = option.autofix;
        const handleObjectProp = (prop, defaultProps) => {
            if (prop.type === "object" && prop.propName && prop.value.type === "ObjectExpression" && (utils.findProperty(prop.value, "default") || defaultProps?.has(prop.propName))) {
                const requiredProperty = utils.findProperty(prop.value, "required");
                if (!requiredProperty) return;
                const requiredNode = requiredProperty.value;
                if (requiredNode && requiredNode.type === "Literal" && Boolean(requiredNode.value)) context.report({
                    node: prop.node,
                    loc: prop.node.loc,
                    data: { key: prop.propName },
                    messageId: "requireOptional"
                });
            } else if (prop.type === "type" && defaultProps?.has(prop.propName) && prop.required) {
                if (prop.node.type === "TSMethodSignature" && (prop.node.kind === "get" || prop.node.kind === "set") || prop.node.computed) return;
                context.report({
                    node: prop.node,
                    loc: prop.node.loc,
                    data: { key: prop.propName },
                    messageId: "requireOptional"
                });
            }
        };
        return utils.compositingVisitors(utils.defineVueVisitor(context, { onVueObjectEnter(node) {
            for (const prop of utils.getComponentPropsFromOptions(node)) handleObjectProp(prop);
        } }), utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(node, props) {
            const defaultProps = new Set([...Object.keys(utils.getWithDefaultsPropExpressions(context, node).props), ...Object.keys(utils.getDefaultPropExpressionsForPropsDestructure(node))]);
            for (const prop of props) handleObjectProp(prop, defaultProps);
        } }));
    },
};
