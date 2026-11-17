// Ban static inline styles, including wholly literal bound objects and arrays.
// Runtime-dependent or unresolved style expressions remain allowed as a whole;
// do not split static fields out of a mixed dynamic style. Class selection and
// CSS placement are manual. Unknown keys/spreads are not assumed to contain style.
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

function isStaticStyle(expression) {
    expression = unwrapExpression(expression);
    if (!expression) return false;

    switch (expression.type) {
        case 'Literal':
            return true;
        case 'ParenthesizedExpression':
            return isStaticStyle(expression.expression);
        case 'TemplateLiteral':
            return expression.expressions.every(isStaticStyle);
        case 'ArrayExpression':
            return expression.elements.every((element) => !element
                || isStaticStyle(element.type === 'SpreadElement' ? element.argument : element));
        case 'ObjectExpression':
            return expression.properties.every((property) => property.type === 'SpreadElement'
                ? isStaticStyle(property.argument)
                : property.kind === 'init' && !property.method
                    && (!property.computed || isStaticStyle(property.key)) && isStaticStyle(property.value));
        case 'UnaryExpression':
            return expression.operator !== 'delete' && isStaticStyle(expression.argument);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return isStaticStyle(expression.left) && isStaticStyle(expression.right);
        case 'ConditionalExpression':
            return isStaticStyle(expression.test)
                && isStaticStyle(expression.consequent) && isStaticStyle(expression.alternate);
        case 'SequenceExpression':
            return expression.expressions.every(isStaticStyle);
        default:
            // Identifiers, member accesses, and calls may depend on runtime state.
            return false;
    }
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Use CSS classes instead of static inline styles; runtime-dependent styles are allowed.',
        includeInReadme: true,
        schema: [],
        messages: {
            staticStyle: 'Move this static inline style into CSS classes in the component’s style block or use existing utility classes. Literal bindings are still static. Preserve the styling when correcting manually; style bindings with runtime-dependent values are allowed.',
        },
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services.defineTemplateBodyVisitor) return {};
        const isStyle = (name) => typeof name === 'string' && name.toLowerCase() === 'style';

        function checkObject(expression) {
            expression = unwrapExpression(expression);
            if (!expression) return;
            if (expression.type === 'ParenthesizedExpression') {
                checkObject(expression.expression);
            } else if (expression.type === 'ObjectExpression') {
                for (const property of expression.properties) {
                    if (property.type === 'SpreadElement') checkObject(property.argument);
                    else if (isStyle(getStaticPropertyName(property)) && property.kind === 'init'
                        && !property.method && isStaticStyle(property.value)) {
                        context.report({node: property, messageId: 'staticStyle'});
                    }
                }
            } else if (expression.type === 'ConditionalExpression') {
                if (!isStaticStyle(expression.test)) return;
                checkObject(expression.consequent);
                checkObject(expression.alternate);
            } else if (expression.type === 'LogicalExpression') {
                if (!isStaticStyle(expression.left)) return;
                checkObject(expression.left);
                checkObject(expression.right);
            } else if (expression.type === 'SequenceExpression') {
                checkObject(expression.expressions.at(-1));
            }
        }

        return services.defineTemplateBodyVisitor({
            VAttribute(node) {
                if (!node.directive) {
                    if (isStyle(node.key.name)) context.report({node, messageId: 'staticStyle'});
                    return;
                }
                if (node.key.name.name !== 'bind') return;
                const argument = node.key.argument;
                if (!argument) {
                    checkObject(node.value?.expression);
                    return;
                }
                const name = argument.type === 'VIdentifier' ? argument.name
                    : getStaticPropertyName({computed: true, key: unwrapExpression(argument.expression)});
                if (isStyle(name) && isStaticStyle(node.value?.expression)) {
                    context.report({node, messageId: 'staticStyle'});
                }
            },
        });
    },
};
