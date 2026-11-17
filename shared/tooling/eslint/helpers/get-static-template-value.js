import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export const unknownTemplateValue = Symbol('unknown template value');

export function getStaticTemplateValue(expression, undefinedReferences) {
    expression = unwrapExpression(expression);
    if (undefinedReferences.has(expression)) return undefined;
    if (expression?.type === 'Literal') return expression.regex ? unknownTemplateValue : expression.value;
    if (expression?.type === 'TemplateLiteral' && !expression.expressions.length) return expression.quasis[0].value.cooked;
    if (expression?.type === 'ArrayExpression') {
        if (expression.elements.some((element) => element?.type === 'SpreadElement')) return unknownTemplateValue;
        return expression.elements.map((element) => element ? getStaticTemplateValue(element, undefinedReferences) : undefined);
    }
    if (expression?.type === 'ObjectExpression') {
        const value = Object.create(null);
        for (const property of expression.properties) {
            if (property.type === 'SpreadElement') {
                const spread = getStaticTemplateValue(property.argument, undefinedReferences);
                if (spread === unknownTemplateValue) return unknownTemplateValue;
                if (spread && typeof spread === 'object') Object.assign(value, spread);
                continue;
            }
            const name = !property.computed && property.key.type === 'Identifier' ? property.key.name : getStaticTemplateValue(property.key, undefinedReferences);
            if (typeof name !== 'string' || property.kind !== 'init') return unknownTemplateValue;
            value[name] = getStaticTemplateValue(property.value, undefinedReferences);
        }
        return value;
    }
    if (expression?.type === 'UnaryExpression') {
        if (expression.operator === 'void') return undefined;
        const value = getStaticTemplateValue(expression.argument, undefinedReferences);
        if (value === unknownTemplateValue) return unknownTemplateValue;
        if (expression.operator === '-' && typeof value === 'number') return -value;
        if (expression.operator === '+' && typeof value === 'number') return value;
        if (expression.operator === '!') return !value;
    }
    if (expression?.type === 'BinaryExpression' && expression.operator === '+') {
        const left = getStaticTemplateValue(expression.left, undefinedReferences);
        const right = getStaticTemplateValue(expression.right, undefinedReferences);
        if (['string', 'number'].includes(typeof left) && ['string', 'number'].includes(typeof right)) return left + right;
    }
    return unknownTemplateValue;
}
