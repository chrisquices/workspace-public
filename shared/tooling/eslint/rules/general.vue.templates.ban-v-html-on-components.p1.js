import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use v-html directly on Vue components.',
        includeInReadme: true,
        schema: [],
        messages: {
            "disallow": "Remove {{directiveName}} from this component. Use its supported slots or another appropriate element, preserving content and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"ignoreElementNamespaces":false,"allow":[]}];

        const options = ruleOptions[0] || {};
        const allow = new Set(options.allow);
        const shouldIgnoreElementNamespaces = options.ignoreElementNamespaces === true;
        /**
        * Check whether the given node is an allowed component or not.
        * @param node The start tag node to check.
        */
        function isAllowedComponent(node) {
            const componentName = node.rawName;
            return allow.has(componentName) || allow.has(require_casing.pascalCase(componentName)) || allow.has(require_casing.kebabCase(componentName));
        }
        /**
        * Verify for v-text and v-html directive
        */
        function verify(node) {
            const element = node.parent.parent;
            if (utils.isCustomComponent(element, shouldIgnoreElementNamespaces) && !isAllowedComponent(element)) context.report({
                node,
                loc: node.loc,
                data: { directiveName: `v-${node.key.name.name}` },
                messageId: "disallow"
            });
        }
        return utils.defineTemplateBodyVisitor(context, {

            "VAttribute[directive=true][key.name.name='html']": verify
        });
    },
};
