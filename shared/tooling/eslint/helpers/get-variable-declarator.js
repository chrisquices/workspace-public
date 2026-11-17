export function getVariableDeclarator(node) {
    const declaration = node.parent;

    return declaration?.type === 'VariableDeclarator' && declaration.init === node ? declaration : null;
}
