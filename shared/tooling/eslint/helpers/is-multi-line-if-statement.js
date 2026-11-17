export function isMultilineIfStatement(node) {
    return node.type === 'IfStatement' && node.loc.start.line !== node.loc.end.line;
}
