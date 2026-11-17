import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
const RESERVED = {
    3: ["key", "ref"],
    2: [
        "key",
        "ref",
        "is",
        "slot",
        "slot-scope",
        "slotScope",
        "class",
        "style"
    ]
};

export default {
    meta: {
        type: "problem",
        description: 'Do not declare key or ref as Vue props.',
        includeInReadme: true,
        schema: [],
        messages: {
            "reserved": "'{{propName}}' is a reserved attribute and cannot be used as props." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"vueVersion":3}];

        const vueVersion = (ruleOptions[0] || {}).vueVersion || 3;
        const reserved = new Set(RESERVED[vueVersion]);
        function processProps(props) {
            for (const prop of props) if (prop.propName != null && reserved.has(prop.propName)) context.report({
                node: prop.node,
                data: { propName: require_casing.kebabCase(prop.propName) },
                messageId: "reserved"
            });
        }
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(_node, props) {
            processProps(props);
        } }), utils.executeOnVue(context, (obj) => {
            processProps(utils.getComponentPropsFromOptions(obj));
        }));
    },
};
