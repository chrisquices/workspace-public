export function getModuleScope(sourceCode) {
    return sourceCode.scopeManager.acquire(sourceCode.ast, true) ?? sourceCode.getScope(sourceCode.ast);
}
