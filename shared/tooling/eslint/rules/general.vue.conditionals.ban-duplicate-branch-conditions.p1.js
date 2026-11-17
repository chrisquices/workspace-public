import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function splitByLogicalOperator(operator, node) {
    if (node.type === "LogicalExpression" && node.operator === operator) return [...splitByLogicalOperator(operator, node.left), ...splitByLogicalOperator(operator, node.right)];
    return [node];
}
function splitByOr(node) {
    return splitByLogicalOperator("||", node);
}
function splitByAnd(node) {
    return splitByLogicalOperator("&&", node);
}
function buildOrOperands(node) {
    return {
        node,
        operands: splitByOr(node).map((orOperand) => {
            return {
                node: orOperand,
                operands: splitByAnd(orOperand)
            };
        })
    };
}

export default {
    meta: {
        type: "problem",
        description: 'Do not repeat or cover earlier conditions in a Vue conditional chain.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "This branch can never execute. Its condition is a duplicate or covered by previous conditions in the `v-if` / `v-else-if` chain." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const sourceCode = context.sourceCode;
        const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore && sourceCode.parserServices.getTemplateBodyTokenStore();
        /**
        * Determines whether the two given nodes are considered to be equal. In particular, given that the nodes
        * represent expressions in a boolean context, `||` and `&&` can be considered as commutative operators.
        */
        function isEqual(a, b) {
            return a.type === b.type && (utils.equalTokens(a, b, tokenStore) || a.type === "LogicalExpression" && b.type === "LogicalExpression" && (a.operator === "||" || a.operator === "&&") && a.operator === b.operator && (isEqual(a.left, b.left) && isEqual(a.right, b.right) || isEqual(a.left, b.right) && isEqual(a.right, b.left)));
        }
        /**
        * Determines whether the first given AndOperands is a subset of the second given AndOperands.
        *
        * e.g. A: (a && b), B: (a && b && c): B is a subset of A.
        */
        function isSubset(operandsA, operandsB) {
            return operandsA.operands.every((operandA) => operandsB.operands.some((operandB) => isEqual(operandA, operandB)));
        }
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='else-if']"(node) {
            if (!node.value || !node.value.expression) return;
            const test = node.value.expression;
            const listToCheck = (test.type === "LogicalExpression" && test.operator === "&&" ? [...splitByAnd(test), test] : [test]).map(buildOrOperands);
            let current = node.parent.parent;
            while (current &&= utils.prevSibling(current)) {
                const vIf = utils.getDirective(current, "if");
                const currentTestDir = vIf || utils.getDirective(current, "else-if");
                if (!currentTestDir) return;
                if (currentTestDir.value && currentTestDir.value.expression) {
                    const currentOrOperands = buildOrOperands(currentTestDir.value.expression);
                    for (const condition of listToCheck) if ((condition.operands = condition.operands.filter((orOperand) => currentOrOperands.operands.every((currentOrOperand) => !isSubset(currentOrOperand, orOperand)))).length === 0) {
                        context.report({
                            node: condition.node,
                            messageId: "unexpected"
                        });
                        return;
                    }
                }
                if (vIf) return;
            }
        } });
    },
};
