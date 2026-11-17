import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
import require_regexp from "eslint-plugin-vue/dist/utils/regexp.js";
const utils = require_index.default;
const allowedCaseOptions = ["camelCase", "snake_case"];

export default {
    meta: {
        type: "suggestion",
        description: 'Use camelCase for Vue prop names.',
        includeInReadme: true,
        schema: [],
        messages: {
            "invalidCase": "Prop \"{{name}}\" is not in {{caseType}}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["camelCase",{"ignoreProps":[]}];

    const options = ruleOptions[0];
    const isIgnoredProp = require_regexp.toRegExpGroupMatcher(ruleOptions[1]?.ignoreProps);
    const caseType = allowedCaseOptions.includes(options) ? options : "camelCase";
    const checker = require_casing.getChecker(caseType);
    function processProps(props) {
        for (const item of props) {
            const propName = item.propName;
            if (propName == null) continue;
            if (!checker(propName) && !isIgnoredProp(propName)) context.report({
                node: item.node,
                data: {
                    name: propName,
                    caseType
                },
                messageId: "invalidCase"
            });
        }
    }
    return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(_node, props) {
        processProps(props);
    } }), utils.executeOnVue(context, (obj) => {
        processProps(utils.getComponentPropsFromOptions(obj));
    }));

    },
};
