import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_vue_reserved from "eslint-plugin-vue/dist/utils/vue-reserved.js";
const utils = require_index.default;
const GROUP_NAMES = [
    "props",
    "computed",
    "data",
    "asyncData",
    "methods",
    "setup"
];

export default {
    meta: {
        type: "suggestion",
        description: 'Avoid reserved Vue instance member names and underscore-prefixed data keys.',
        includeInReadme: true,
        schema: [],
        messages: {
            "reserved": "Key '{{name}}' is reserved." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "startsWithUnderscore": "Keys starting with '_' are reserved in '{{name}}' group." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const options = ruleOptions[0] || {};
        const reservedKeys = new Set([...require_vue_reserved.default, ...options.reserved || []]);
        const groups = new Set([...GROUP_NAMES, ...options.groups || []]);
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(_node, props) {
            for (const prop of props) {
                if (!prop.propName || !reservedKeys.has(prop.propName)) continue;
                const { propName, node } = prop;
                context.report({
                    node,
                    data: { name: propName },
                    messageId: "reserved"
                });
            }
        } }), utils.executeOnVue(context, (obj) => {
            const properties = utils.iterateProperties(obj, groups);
            for (const o of properties) if ((o.groupName === "data" || o.groupName === "asyncData") && o.name[0] === "_") context.report({
                node: o.node,
                data: { name: o.name },
                messageId: "startsWithUnderscore"
            });
            else if (reservedKeys.has(o.name)) context.report({
                node: o.node,
                data: { name: o.name },
                messageId: "reserved"
            });
        }));
    },
};
