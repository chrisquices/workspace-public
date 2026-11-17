export function isEngineFactory(node) {
    if (node.body?.type !== 'BlockStatement') return false;

    if (node.type === 'FunctionDeclaration') {
        return /^create[A-Z]/.test(node.id?.name ?? '')
            && ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(node.parent.type);
    }

    const declaration = node.parent;
    return declaration.type === 'VariableDeclarator'
        && declaration.init === node
        && declaration.id.type === 'Identifier'
        && /^create[A-Z]/.test(declaration.id.name)
        && declaration.parent.parent.type === 'ExportNamedDeclaration';
}
