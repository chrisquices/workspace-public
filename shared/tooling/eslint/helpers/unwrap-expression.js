export function unwrapExpression(node) {
    while (node && [
        'ChainExpression',
        'ParenthesizedExpression',
        'TSAsExpression',
        'TSTypeAssertion',
        'TSNonNullExpression',
        'TSSatisfiesExpression',
        'TSInstantiationExpression',
    ].includes(node.type)) {
        node = node.expression;
    }

    return node;
}
