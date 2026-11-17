import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use defineOptions only for valid options and declare props, emits, expose, and slots with their own macros.',
        includeInReadme: true,
        schema: [],
        messages: {
            "referencingLocally": "`defineOptions` is referencing locally declared variables." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "multiple": "`defineOptions` has been called multiple times." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "notDefined": "Options are not defined." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowProp": "`defineOptions()` cannot be used to declare `{{propName}}`. Use `{{insteadMacro}}()` instead." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "typeArgs": "`defineOptions()` cannot accept type arguments." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const scriptSetup = utils.getScriptSetupElement(context);
        if (!scriptSetup) return {};
        const optionsDefExpressions = new Set();
        const defineOptionsNodes = [];
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, {
            onDefineOptionsEnter(node) {
                defineOptionsNodes.push(node);
                if (node.arguments.length > 0) {
                    const define = node.arguments[0];
                    if (define.type === "ObjectExpression") {
                        for (const [propName, insteadMacro] of [
                            ["props", "defineProps"],
                            ["emits", "defineEmits"],
                            ["expose", "defineExpose"],
                            ["slots", "defineSlots"]
                        ]) if (utils.findProperty(define, propName)) context.report({
                            node,
                            data: {
                                propName,
                                insteadMacro
                            },
                            messageId: "disallowProp"
                        });
                    }
                    optionsDefExpressions.add(node.arguments[0]);
                } else context.report({
                    node,
                    messageId: "notDefined"
                });
                const typeArguments = "typeArguments" in node ? node.typeArguments : node.typeParameters;
                if (typeArguments) context.report({
                    node: typeArguments,
                    messageId: "typeArgs"
                });
            },
            Identifier(node) {
                for (const defineOptions of optionsDefExpressions) {
                    if (!utils.inRange(defineOptions.range, node)) continue;
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
                    if (!variable || variable.references.every((ref) => ref.identifier !== node) || variable.defs.length === 0 || variable.defs.some((def) => def.type === "ImportBinding" || !utils.inRange(scriptSetup.range, def.name) || utils.inRange(defineOptions.range, def.name) || def.type === "Variable" && def.parent.kind === "const" && def.node.init && def.node.init.type === "Literal") || utils.withinTypeNode(node)) continue;
                    context.report({
                        node,
                        messageId: "referencingLocally"
                    });
                }
            }
        }), { "Program:exit"() {
            if (defineOptionsNodes.length > 1) for (const node of defineOptionsNodes) context.report({
                node,
                messageId: "multiple"
            });
        } });
    },
};
