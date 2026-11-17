import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function getName(attribute) {
    return attribute.directive ? attribute.key.name.name === "bind" && attribute.key.argument?.type === "VIdentifier" && attribute.key.argument.name || null : attribute.key.name;
}

export default {
    meta: {
        type: "problem",
        description: 'Do not duplicate Vue template attributes; static and bound class or style may coexist.',
        includeInReadme: true,
        schema: [],
        messages: {
            "duplicateAttribute": "Duplicate attribute '{{name}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowCoexistClass":true,"allowCoexistStyle":true}];

        const options = ruleOptions[0] || {};
        const shouldAllowCoexistStyle = options.allowCoexistStyle !== false;
        const shouldAllowCoexistClass = options.allowCoexistClass !== false;
        const directiveNames = new Set();
        const attributeNames = new Set();
        function isDuplicate(name, isDirective) {
            if (shouldAllowCoexistStyle && name === "style" || shouldAllowCoexistClass && name === "class") return isDirective ? directiveNames.has(name) : attributeNames.has(name);
            return directiveNames.has(name) || attributeNames.has(name);
        }
        return utils.defineTemplateBodyVisitor(context, {
            VStartTag() {
                directiveNames.clear();
                attributeNames.clear();
            },
            VAttribute(node) {
                const name = getName(node);
                if (name == null) return;
                if (isDuplicate(name, node.directive)) context.report({
                    node,
                    loc: node.loc,
                    data: { name },
                    messageId: "duplicateAttribute"
                });
                if (node.directive) directiveNames.add(name);
                else attributeNames.add(name);
            }
        });
    },
};
