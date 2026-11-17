// Keep Vue mustache expressions on one line by editing token gaps only.
// Preserve literal contents and comments; never join statement/type-member
// bodies where a newline may act as a separator through automatic insertion.
export default {
    meta: {
        type: "layout",
        description: 'Keep Vue interpolations on a single line.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            singleLine: "Write this interpolation on one line as {{ expression }}. Preserve the expression and its values.",
            manual: "Write this interpolation on one line manually. Preserve comments, multiline literal values, statement or type-member separators, and line-sensitive directives.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokenStore = services.getTemplateBodyTokenStore();
        const newline = /[\r\n\u2028\u2029]/u;
        const commentTypes = new Set(["Line", "Block", "HTMLComment"]);
        const separatorBodies = new Set(["BlockStatement", "ClassBody", "TSInterfaceBody", "TSTypeLiteral", "TSModuleBlock"]);
        const directives = tokenStore.getTokens(template, { includeComments: true }).filter((token) =>
            commentTypes.has(token.type)
            && /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(token.value));

        function hasMultilineBody(expression) {
            const pending = [expression];
            while (pending.length) {
                const node = pending.pop();
                if (separatorBodies.has(node.type) && newline.test(sourceCode.getText(node))) return true;
                const keys = sourceCode.visitorKeys[node.type];
                if (!keys) return true;
                for (const key of keys) {
                    const children = Array.isArray(node[key]) ? node[key] : [node[key]];
                    for (const child of children) {
                        if (child && typeof child.type === "string") pending.push(child);
                    }
                }
            }
            return false;
        }

        return services.defineTemplateBodyVisitor({
            "VExpressionContainer[expression!=null]"(node) {
                if (!newline.test(sourceCode.getText(node))) return;
                const tokens = tokenStore.getTokens(node, { includeComments: true });
                if (tokens[0]?.type !== "VExpressionStart" || tokens.at(-1)?.type !== "VExpressionEnd") return;

                let manual = tokens.some((token) => commentTypes.has(token.type) || newline.test(sourceCode.getText(token)))
                    || hasMultilineBody(node.expression)
                    || directives.some((comment) => comment.loc.start.line <= node.loc.end.line
                        && comment.loc.end.line + 1 >= node.loc.start.line);
                const edits = [];
                for (let index = 1; index < tokens.length; index++) {
                    const range = [tokens[index - 1].range[1], tokens[index].range[0]];
                    const gap = sourceCode.text.slice(...range);
                    if (!/^\s*$/u.test(gap)) manual = true;
                    const edge = index === 1 || index === tokens.length - 1;
                    if ((edge && gap !== " ") || newline.test(gap)) edits.push({ range, text: " " });
                }
                if (!edits.length) manual = true;

                context.report({
                    node,
                    messageId: manual ? "manual" : "singleLine",
                    fix(fixer) {
                        return manual ? null : edits.map(({ range, text }) => fixer.replaceTextRange(range, text));
                    },
                });
            },
        });
    },
};
