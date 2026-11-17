// Whitespace in literals, template text, attributes and embedded styles
// can carry meaning. Use parsed ranges; do not trim those payloads as code.
export default {
    meta: {
        type: "layout",
        description: 'Remove trailing whitespace outside meaningful content.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: { trailing: "Remove this trailing whitespace while preserving the line ending and meaningful literal or embedded content." },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            "Program:exit"() {
                const protectedRanges = [];
                const seen = new Set();
                const stack = [source.ast, source.parserServices.getDocumentFragment?.()];
                while (stack.length) {
                    const node = stack.pop();
                    if (!node || seen.has(node)) continue;
                    seen.add(node);
                    const scriptText = node.type === "VText" && node.parent?.rawName === "script"
                        && node.parent.parent?.type === "VDocumentFragment";
                    const scriptLanguage = scriptText && node.parent.startTag.attributes.find(function (attribute) {
                        return !attribute.directive && attribute.key.name === "lang";
                    })?.value?.value;
                    const scriptType = scriptText && node.parent.startTag.attributes.find(function (attribute) {
                        return !attribute.directive && attribute.key.name === "type";
                    })?.value?.value;
                    const parsedScriptText = scriptText
                        && (!scriptLanguage || ["js", "jsx", "ts", "tsx", "javascript", "typescript"].includes(scriptLanguage))
                        && (!scriptType || ["module", "text/javascript", "application/javascript"].includes(scriptType));
                    const topLevelPadding = node.type === "VText" && node.parent?.type === "VDocumentFragment"
                        && !/\S/u.test(source.getText(node));
                    if (["TemplateElement", "Literal", "VLiteral", "VText", "JSXText"].includes(node.type) && !parsedScriptText && !topLevelPadding) {
                        protectedRanges.push(node.range);
                    }
                    if (node.type === "VElement" && node.parent?.type === "VDocumentFragment" && !["script", "template"].includes(node.rawName)) {
                        protectedRanges.push([node.startTag.range[1], node.endTag?.range[0] ?? node.range[1]]);
                    }
                    for (const [key, value] of Object.entries(node)) {
                        if (["parent", "tokens", "comments", "variables", "references"].includes(key)) continue;
                        if (Array.isArray(value)) {
                            for (const child of value) if (child?.type && child.range) stack.push(child);
                        } else if (value?.type && value.range) stack.push(value);
                    }
                }
                const pattern = /[^\S\r\n\u2028\u2029]+(?=\r\n|[\r\n\u2028\u2029]|$)/gu;
                for (const match of source.text.matchAll(pattern)) {
                    const range = [match.index, match.index + match[0].length];
                    if (protectedRanges.some(function ([start, end]) { return range[0] < end && range[1] > start; })) continue;
                    const blockComment = source.getAllComments().some(function (comment) {
                        return comment.type === "Block" && range[0] > comment.range[0] && range[1] < comment.range[1];
                    });
                    context.report({
                        loc: { start: source.getLocFromIndex(range[0]), end: source.getLocFromIndex(range[1]) },
                        messageId: "trailing",
                        fix(fixer) {
                            // Markdown hard line breaks in documentation may be intentional.
                            if (blockComment && match[0].endsWith("  ")) return null;
                            return fixer.removeRange(range);
                        },
                    });
                }
            },
        };
    },
};
