import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isUsingIterationVar(vIf) {
    return getVForUsingIterationVar(vIf) !== null;
}
function getVForUsingIterationVar(vIf) {
    if (!vIf.value) return null;
    const element = vIf.parent.parent;
    for (const reference of vIf.value.references) {
        const targetVFor = element.variables.find((variable) => variable.id.name === reference.id.name && variable.kind === "v-for");
        if (targetVFor) return targetVFor;
    }
    return null;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Do not put v-if and v-for on the same element.',
        includeInReadme: true,
        schema: [],
        messages: {
            "movedToWrapper": "This 'v-if' should be moved to the wrapper element." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "shouldUseComputed": "The '{{iteratorName}}' {{kind}} inside 'v-for' directive should be replaced with a computed property that returns filtered array instead. You should not mix 'v-for' with 'v-if'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowUsingIterationVar":false}];

        const shouldAllowUsingIterationVar = (ruleOptions[0] || {}).allowUsingIterationVar === true;
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='if']"(node) {
            const element = node.parent.parent;
            if (utils.hasDirective(element, "for")) {
                if (isUsingIterationVar(node)) {
                    if (!shouldAllowUsingIterationVar) {
                        const vForVar = getVForUsingIterationVar(node);
                        if (!vForVar) return;
                        let targetVForExpr = vForVar.id.parent;
                        while (targetVForExpr.type !== "VForExpression") targetVForExpr = targetVForExpr.parent;
                        const iteratorNode = targetVForExpr.right;
                        context.report({
                            node,
                            loc: node.loc,
                            data: {
                                iteratorName: iteratorNode.type === "Identifier" ? iteratorNode.name : context.sourceCode.getText(iteratorNode),
                                kind: iteratorNode.type === "Identifier" ? "variable" : "expression"
                            },
                            messageId: "shouldUseComputed"
                        });
                    }
                } else context.report({
                    node,
                    loc: node.loc,
                    messageId: "movedToWrapper"
                });
            }
        } });
    },
};
