import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function verifyMemoExpression(context, expression, expressions) {
    switch (expression.type) {
        case "ObjectExpression":
        case "ClassExpression":
        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "Literal":
        case "TemplateLiteral":
        case "UnaryExpression":
        case "BinaryExpression":
        case "UpdateExpression":
            context.report({
                node: expression,
                messageId: "expectedArray"
            });
            break;
        case "AssignmentExpression":
            expressions.push(expression.right);
            break;
        case "TSAsExpression":
            expressions.push(expression.expression);
            break;
        case "SequenceExpression": {
            const lastExpression = expression.expressions.at(-1);
            if (lastExpression) expressions.push(lastExpression);
            break;
        }
        case "ConditionalExpression": expressions.push(expression.consequent, expression.alternate);
    }
}

export default {
    meta: {
        type: "problem",
        description: 'Use v-memo with an array expression and valid placement.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedArgument": "'v-memo' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-memo' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValue": "'v-memo' directives require that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedArray": "'v-memo' directives require the attribute value to be an array." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "insideVFor": "'v-memo' directive does not work inside 'v-for'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        let vForElement = null;
        return utils.defineTemplateBodyVisitor(context, {
            VElement(node) {
                if (!vForElement && utils.hasDirective(node, "for")) vForElement = node;
            },
            "VElement:exit"(node) {
                if (vForElement === node) vForElement = null;
            },
            "VAttribute[directive=true][key.name.name='memo']"(node) {
                if (vForElement && vForElement !== node.parent.parent) context.report({
                    node: node.key,
                    messageId: "insideVFor"
                });
                if (node.key.argument) context.report({
                    node: node.key.argument,
                    messageId: "unexpectedArgument"
                });
                const lastModifier = node.key.modifiers.at(-1);
                if (lastModifier) context.report({
                    node,
                    loc: {
                        start: node.key.modifiers[0].loc.start,
                        end: lastModifier.loc.end
                    },
                    messageId: "unexpectedModifier"
                });
                if (!node.value || utils.isEmptyValueDirective(node, context)) {
                    context.report({
                        node,
                        messageId: "expectedValue"
                    });
                    return;
                }
                if (!node.value.expression) return;
                const expressions = [node.value.expression];
                let expression;
                while (expression = expressions.pop()) verifyMemoExpression(context, expression, expressions);
            }
        });
    },
};
