import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use a single valid defineEmits declaration with either runtime or type definitions.',
        includeInReadme: true,
        schema: [],
        messages: {
            "hasTypeAndArg": "`defineEmits` has both a type-only emit and an argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "referencingLocally": "`defineEmits` is referencing locally declared variables." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "multiple": "`defineEmits` has been called multiple times." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "notDefined": "Custom events are not defined." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "definedInBoth": "Custom events are defined in both `defineEmits` and `export default {}`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const scriptSetup = utils.getScriptSetupElement(context);
        if (!scriptSetup) return {};
        const emitsDefExpressions = new Set();
        let hasDefaultExport = false;
        const defineEmitsNodes = [];
        let emptyDefineEmits = null;
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, {
            onDefineEmitsEnter(node) {
                defineEmitsNodes.push(node);
                const typeArguments = "typeArguments" in node ? node.typeArguments : node.typeParameters;
                if (node.arguments.length > 0) {
                    if (typeArguments && typeArguments.params.length > 0) {
                        context.report({
                            node,
                            messageId: "hasTypeAndArg"
                        });
                        return;
                    }
                    emitsDefExpressions.add(node.arguments[0]);
                } else if (!typeArguments || typeArguments.params.length === 0) emptyDefineEmits = node;
            },
            Identifier(node) {
                for (const defineEmits of emitsDefExpressions) {
                    if (!utils.inRange(defineEmits.range, node)) continue;
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
                    if (!variable || variable.references.every((ref) => ref.identifier !== node) || variable.defs.length === 0 || variable.defs.some((def) => def.type === "ImportBinding" || !utils.inRange(scriptSetup.range, def.name) || utils.inRange(defineEmits.range, def.name)) || utils.withinTypeNode(node)) continue;
                    context.report({
                        node,
                        messageId: "referencingLocally"
                    });
                }
            }
        }), utils.defineVueVisitor(context, { onVueObjectEnter(node, { type }) {
            if (type !== "export" || utils.inRange(scriptSetup.range, node)) return;
            hasDefaultExport = Boolean(utils.findProperty(node, "emits"));
        } }), { "Program:exit"() {
            if (defineEmitsNodes.length === 0) return;
            if (defineEmitsNodes.length > 1) {
                for (const node of defineEmitsNodes) context.report({
                    node,
                    messageId: "multiple"
                });
                return;
            }
            if (emptyDefineEmits) {
                if (!hasDefaultExport) context.report({
                    node: emptyDefineEmits,
                    messageId: "notDefined"
                });
            } else if (hasDefaultExport) for (const node of defineEmitsNodes) context.report({
                node,
                messageId: "definedInBoth"
            });
        } });
    },
};
