const tokenOptions = {includeComments: true, filter: (token) => token.type !== 'HTMLWhitespace'};

export function getPreviousNonWhitespaceToken(tokenStore, node) {
    return tokenStore.getTokenBefore(node, tokenOptions);
}
