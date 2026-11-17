// Allow at most one ternary per expression, including sibling ternaries in
// arithmetic, call arguments, and arrays. Retain the nesting ban.
// Rewriting control flow or naming intermediate values requires manual judgment.
function expressionRoot(node) {
    let root = node;
    while (root.parent) {
        const parent = root.parent;
        // Independent function bodies/defaults are separate expression contexts.
        if (['ArrowFunctionExpression', 'FunctionExpression', 'ClassExpression'].includes(parent.type)) break;
        if (!parent.type.endsWith('Expression')
            && !['TemplateLiteral', 'SpreadElement'].includes(parent.type)) break;
        root = parent;
    }
    return root;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Ban multiple ternaries in one expression, including nested and sibling ternaries, in JavaScript, TypeScript, and Vue expressions.',
        includeInReadme: true,
        schema: [],
        messages: {
            nested: 'Replace this nested ternary with explicit if statements, guard returns, or a named intermediate value. Allow only one ternary level and preserve condition order, short-circuit evaluation, and side effects.',
            multiple: 'Use at most one ternary per expression. Split these conditions into appropriately named values or explicit if statements, preserving evaluation order, short-circuit behavior, and side effects.',
        },
    },
    create(context) {
        const seen = new WeakSet();
        const listeners = {
            ConditionalExpression(node) {
                const root = expressionRoot(node);
                const multiple = seen.has(root);
                seen.add(root);
                for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
                    if (ancestor.type !== 'ConditionalExpression') continue;
                    context.report({node, messageId: 'nested'});
                    return;
                }
                if (multiple) context.report({node, messageId: 'multiple'});
            },
        };

        return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(listeners, listeners) ?? listeners;
    },
};
