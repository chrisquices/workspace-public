export function getSingleLineTernary(node, sourceCode) {
    if (sourceCode.getCommentsInside(node).length) return null;

    const tokens = sourceCode.getTokens(node);
    if (tokens.some((token) => /[\r\n\u2028\u2029]/u.test(token.value)
        || ['=>', 'function', 'class'].includes(token.value))) return null;

    let inline = '';
    let position = node.range[0];
    for (const token of tokens) {
        inline += sourceCode.text.slice(position, token.range[0]).replace(/[\t ]*(?:\r\n|[\n\r\u2028\u2029])[\t\r\n \u2028\u2029]*/gu, ' ');
        inline += sourceCode.text.slice(...token.range);
        position = token.range[1];
    }
    inline += sourceCode.text.slice(position, node.range[1]);

    const prefix = sourceCode.lines[node.loc.start.line - 1].slice(0, node.loc.start.column);
    const suffix = sourceCode.lines[node.loc.end.line - 1].slice(node.loc.end.column);
    if (/[\r\n\u2028\u2029]/u.test(inline) || Array.from(prefix + inline + suffix).length > 100) return null;

    return inline;
}
