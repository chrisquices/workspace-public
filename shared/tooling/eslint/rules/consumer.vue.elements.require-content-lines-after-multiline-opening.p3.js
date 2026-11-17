// Multiline opening tags put their content and closing tag on separate lines.
// The child-element layout rule already owns elements containing nested elements.
// Edit only outer content boundaries, never text, entities, or expression contents.
export default {
    meta: {
        type: "layout",
        description: 'Place content and closing tags on separate lines after multiline opening tags.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            layout: "Place the content of <{{element}}> below its multiline opening tag and put its closing tag on a separate line. Preserve the content and expressions.",
            manual: "Separate the content and closing tag of <{{element}}> manually. Preserve preformatted content, SVG text, and line-sensitive comment targets.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokens = services.getTemplateBodyTokenStore();
        const directiveLines = new Set();
        for (const token of tokens.getTokens(template, { includeComments: true })) {
            if (["HTMLComment", "Line", "Block"].includes(token.type)
                && /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(token.value)) {
                for (let line = token.loc.start.line; line <= token.loc.end.line + 1; line++) directiveLines.add(line);
            }
        }
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? "\n";

        return services.defineTemplateBodyVisitor({
            VElement(node) {
                if (!node.endTag || node.startTag.selfClosing
                    || node.startTag.loc.start.line === node.startTag.loc.end.line
                    || node.children.some((child) => child.type === "VElement")) return;

                const start = node.startTag.range[1];
                const end = node.endTag.range[0];
                const content = sourceCode.text.slice(start, end);
                if (!content.trim()) return;
                const leading = content.match(/^[\t \f\r\n\u2028\u2029]*/u)[0];
                const trailing = content.match(/[\t \f\r\n\u2028\u2029]*$/u)[0];
                const needsLeading = !/[\r\n\u2028\u2029]/u.test(leading);
                const needsTrailing = !/[\r\n\u2028\u2029]/u.test(trailing);
                if (!needsLeading && !needsTrailing) return;

                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                let unit = indent.includes("\t") ? "\t" : "    ";
                const attribute = node.startTag.attributes.find((item) => item.loc.start.line > node.loc.start.line);
                if (attribute) {
                    const prefix = sourceCode.lines[attribute.loc.start.line - 1].slice(0, attribute.loc.start.column);
                    if (/^[\t ]*$/u.test(prefix) && prefix.startsWith(indent) && prefix.length > indent.length) {
                        unit = prefix.slice(indent.length);
                    }
                }

                let manual = (needsLeading && directiveLines.has(node.startTag.loc.end.line))
                    || (needsTrailing && directiveLines.has(node.endTag.loc.start.line));
                for (let ancestor = node; ancestor?.type === "VElement"; ancestor = ancestor.parent) {
                    if (["pre", "textarea", "script", "style"].includes(ancestor.rawName)
                        || (ancestor.namespace === "http://www.w3.org/2000/svg" && ["text", "tspan", "textPath"].includes(ancestor.rawName))
                        || ancestor.startTag.attributes.some((item) => item.directive && item.key.name.name === "pre")) {
                        manual = true;
                        break;
                    }
                }

                context.report({
                    node: node.startTag,
                    messageId: manual ? "manual" : "layout",
                    data: { element: node.rawName },
                    fix(fixer) {
                        if (manual) return null;
                        const edits = [];
                        if (needsLeading) edits.push(fixer.insertTextBeforeRange([start, end], newline + indent + unit));
                        if (needsTrailing) edits.push(fixer.insertTextAfterRange([start, end], newline + indent));
                        return edits;
                    },
                });
            },
        });
    },
};
