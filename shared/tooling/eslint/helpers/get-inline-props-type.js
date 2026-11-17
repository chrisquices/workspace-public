export function getInlinePropsType(node) {
    const types = node.typeArguments?.params ?? [];

    return types.length === 1 && types[0].type === 'TSTypeLiteral' ? types[0] : null;
}
