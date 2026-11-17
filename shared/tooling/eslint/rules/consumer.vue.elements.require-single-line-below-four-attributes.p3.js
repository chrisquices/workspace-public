// Keep native and template opening tags with fewer than four attributes on one line.
// Component attribute layouts belong to their UI rules. Do not rewrite content,
// attribute values, or multiline expressions to satisfy opening-tag layout.
import vueUtils from "eslint-plugin-vue/dist/utils/index.js";

const utils = vueUtils.default;

export default {
    meta: {
        type: "layout",
        description: 'Keep native and template opening tags with fewer than four attributes on one line.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            singleLine: "Put the opening tag of <{{element}}> on one line because it has fewer than four attributes. Preserve attribute values and child content.",
            manual: "Put the opening tag of <{{element}}> on one line manually because it has fewer than four attributes, preserving line-sensitive comment targets.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokens = services.getTemplateBodyTokenStore();
        const directives = tokens.getTokens(template, { includeComments: true }).filter((token) =>
            ["HTMLComment", "Block", "Line"].includes(token.type)
            && /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(token.value));

        return services.defineTemplateBodyVisitor({
            VStartTag(node) {
                if (node.attributes.length >= 4 || node.loc.start.line === node.loc.end.line) return;
                const element = node.parent;
                if (element.rawName !== "template"
                    && (utils.isCustomComponent(element) || utils.isVueBuiltInElementName(element.rawName))) return;

                if (node.attributes.some((attribute) => /[\r\n\u2028\u2029]/u.test(sourceCode.getText(attribute)))) return;
                const closing = tokens.getLastToken(node);
                if (!closing || ![">", "/>"].includes(sourceCode.getText(closing))) return;

                const gaps = [];
                let previousEnd = node.range[0] + element.rawName.length + 1;
                for (const attribute of node.attributes) {
                    gaps.push({ range: [previousEnd, attribute.range[0]], text: " " });
                    previousEnd = attribute.range[1];
                }
                gaps.push({ range: [previousEnd, closing.range[0]], text: node.selfClosing ? " " : "" });
                if (gaps.some(({ range }) => !/^[\t \r\n\f]*$/u.test(sourceCode.text.slice(...range)))) return;

                const manual = directives.some((comment) => comment.loc.start.line <= node.loc.end.line
                    && comment.loc.end.line + 1 >= node.loc.start.line);
                context.report({
                    node,
                    messageId: manual ? "manual" : "singleLine",
                    data: { element: element.rawName },
                    fix(fixer) {
                        if (manual) return null;
                        return gaps.filter(({ range, text }) => sourceCode.text.slice(...range) !== text)
                            .map(({ range, text }) => fixer.replaceTextRange(range, text));
                    },
                });
            },
        });
    },
};
