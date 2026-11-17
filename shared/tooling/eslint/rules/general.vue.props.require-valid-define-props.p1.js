import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use a single valid defineProps declaration with either runtime or type definitions.',
        includeInReadme: true,
        schema: [],
        messages: {
            "hasTypeAndArg": "`defineProps` has both a type-only props and an argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "referencingLocally": "`defineProps` is referencing locally declared variables." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "multiple": "`defineProps` has been called multiple times." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "notDefined": "Props are not defined." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "definedInBoth": "Props are defined in both `defineProps` and `export default {}`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const scriptSetup = utils.getScriptSetupElement(context);
        if (!scriptSetup) return {};
        const propsDefExpressions = new Set();
        let hasDefaultExport = false;
        const definePropsNodes = [];
        let emptyDefineProps = null;
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, {
            onDefinePropsEnter(node) {
                definePropsNodes.push(node);
                const typeArguments = "typeArguments" in node ? node.typeArguments : node.typeParameters;
                if (node.arguments.length > 0) {
                    if (typeArguments && typeArguments.params.length > 0) {
                        context.report({
                            node,
                            messageId: "hasTypeAndArg"
                        });
                        return;
                    }
                    propsDefExpressions.add(node.arguments[0]);
                } else if (!typeArguments || typeArguments.params.length === 0) emptyDefineProps = node;
            },
            Identifier(node) {
                for (const defineProps of propsDefExpressions) {
                    if (!utils.inRange(defineProps.range, node)) continue;
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
                    if (!variable || variable.references.every((ref) => ref.identifier !== node) || variable.defs.length === 0 || variable.defs.some((def) => def.type === "ImportBinding" || !utils.inRange(scriptSetup.range, def.name) || utils.inRange(defineProps.range, def.name)) || utils.withinTypeNode(node)) continue;
                    context.report({
                        node,
                        messageId: "referencingLocally"
                    });
                }
            }
        }), utils.defineVueVisitor(context, { onVueObjectEnter(node, { type }) {
            if (type !== "export" || utils.inRange(scriptSetup.range, node)) return;
            hasDefaultExport = Boolean(utils.findProperty(node, "props"));
        } }), { "Program:exit"() {
            if (definePropsNodes.length === 0) return;
            if (definePropsNodes.length > 1) {
                for (const node of definePropsNodes) context.report({
                    node,
                    messageId: "multiple"
                });
                return;
            }
            if (emptyDefineProps) {
                if (!hasDefaultExport) context.report({
                    node: emptyDefineProps,
                    messageId: "notDefined"
                });
            } else if (hasDefaultExport) for (const node of definePropsNodes) context.report({
                node,
                messageId: "definedInBoth"
            });
        } });
    },
};
