export function getStaticPropertyName(node) {
    const key = ['MemberExpression', 'JSXMemberExpression'].includes(node.type) ? node.property : node.key;

    if (!node.computed && ['Identifier', 'JSXIdentifier'].includes(key?.type)) {
        return key.name;
    }

    if (key?.type === 'Literal' && typeof key.value === 'string') {
        return key.value;
    }

    if (key?.type === 'TemplateLiteral' && key.expressions.length === 0) {
        return key.quasis[0].value.cooked;
    }

    return null;
}
