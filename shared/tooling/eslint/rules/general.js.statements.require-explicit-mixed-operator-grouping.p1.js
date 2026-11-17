const { U: isParenthesised, g: import_ast_utils, k: getPrecedence } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const ARITHMETIC_OPERATORS = [
    "+",
    "-",
    "*",
    "/",
    "%",
    "**"
];
const BITWISE_OPERATORS = [
    "&",
    "|",
    "^",
    "~",
    "<<",
    ">>",
    ">>>"
];
const COMPARISON_OPERATORS = [
    "==",
    "!=",
    "===",
    "!==",
    ">",
    ">=",
    "<",
    "<="
];
const LOGICAL_OPERATORS = ["&&", "||"];
const RELATIONAL_OPERATORS = ["in", "instanceof"];
const ALL_OPERATORS = [].concat(ARITHMETIC_OPERATORS, BITWISE_OPERATORS, COMPARISON_OPERATORS, LOGICAL_OPERATORS, RELATIONAL_OPERATORS, ["?:"], ["??"]);
const DEFAULT_GROUPS = [
    ARITHMETIC_OPERATORS,
    BITWISE_OPERATORS,
    COMPARISON_OPERATORS,
    LOGICAL_OPERATORS,
    RELATIONAL_OPERATORS
];
const TARGET_NODE_TYPE = /^(?:Binary|Logical|Conditional)Expression$/u;
function includesBothInAGroup(groups, left, right) {
    return groups.some((group) => group.includes(left) && group.includes(right));
}
function getChildNode(node) {
    return node.type === "ConditionalExpression" ? node.test : node.left;
}

export default {
    meta: {
        type: "layout",
        description: "Require explicit mixed-operator grouping.",
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedMixedOperator": "Unexpected mix of '{{leftOperator}}' and '{{rightOperator}}'. Use parentheses to clarify the intended order of operations." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"groups":[["==","!=","===","!==",">",">=","<","<="],["&&","||"],["in","instanceof"]],"allowSamePrecedence":true}];
        const [options] = ruleOptions;

        const sourceCode = context.sourceCode;
        const { groups, allowSamePrecedence } = options;
        function shouldIgnore(node) {
            const a = node;
            const b = node.parent;
            return !includesBothInAGroup(groups, a.operator, b.type === "ConditionalExpression" ? "?:" : b.operator) || allowSamePrecedence && getPrecedence(a) === getPrecedence(b);
        }
        function isMixedWithParent(node) {
            return node.operator !== node.parent.operator && !isParenthesised(sourceCode, node);
        }
        function getOperatorToken(node) {
            return sourceCode.getTokenAfter(getChildNode(node), import_ast_utils.isNotClosingParenToken);
        }
        function reportBothOperators(node) {
            const parent = node.parent;
            const left = getChildNode(parent) === node ? node : parent;
            const right = getChildNode(parent) !== node ? node : parent;
            const data = {
                leftOperator: left.operator || "?:",
                rightOperator: right.operator || "?:"
            };
            context.report({
                node: left,
                loc: getOperatorToken(left).loc,
                data,
                messageId: "unexpectedMixedOperator"
            });
            context.report({
                node: right,
                loc: getOperatorToken(right).loc,
                data,
                messageId: "unexpectedMixedOperator"
            });
        }
        function check(node) {
            if (TARGET_NODE_TYPE.test(node.parent.type) && isMixedWithParent(node) && !shouldIgnore(node)) reportBothOperators(node);
        }
        return {
            BinaryExpression: check,
            LogicalExpression: check
        };
    },
};
