// Edit only PostCSS's property/value boundary. Never reconstruct values or
// normalize their internal whitespace, strings, functions, or custom tokens.
import { cssStyleMessages, forEachVueStyleBlock } from "#eslint/helpers/for-each-vue-style-block.js";
import { isLineDirective } from "#eslint/helpers/is-line-directive.js";

export default {
    meta: {
        type: "layout",
        description: 'Use one space after CSS declaration colons in Vue style blocks.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            ...cssStyleMessages,
            colon: "Use no whitespace before this declaration's colon and one space before its value begins. Preserve comments and the value's internal whitespace; resolve comment-separated boundaries manually.",
        },
    },

    create(context) {
        const source = context.sourceCode;
        return {
            Program() {
                forEachVueStyleBlock(context, function ({ root, offset }) {
                    const directives = [];
                    root.walkComments(function (comment) {
                        if (isLineDirective({ value: comment.text }) || /stylelint-(?:disable|enable)-(?:next-line|line)\b/u.test(comment.text)) directives.push(comment);
                    });
                    root.walkDecls(function (node) {
                        const between = node.raws.between ?? "";
                        // An empty custom property's whitespace is its value, not
                        // formatting owned by the colon rule.
                        if (node.prop.startsWith("--") && !node.value.trim() && !node.important) return;
                        if (between === ": ") return;
                        const propertyStart = offset + node.source.start.offset;
                        const start = propertyStart + node.prop.length;
                        const end = start + between.length;
                        const firstLine = source.getLocFromIndex(start).line;
                        const lastLine = source.getLocFromIndex(end).line;
                        const safe = /^[\t\f \r\n]*:[\t\f \r\n]*$/u.test(between)
                            && source.text.slice(propertyStart, start) === node.prop
                            && source.text.slice(start, end) === between
                            && (firstLine === lastLine || !directives.some(function (comment) {
                                const commentStart = source.getLocFromIndex(offset + comment.source.start.offset).line;
                                const commentEnd = source.getLocFromIndex(offset + comment.source.end.offset).line;
                                return firstLine <= commentEnd + 1 && lastLine >= commentStart - 1;
                            }));
                        context.report({
                            loc: source.getLocFromIndex(start),
                            messageId: "colon",
                            fix(fixer) { return safe ? fixer.replaceTextRange([start, end], ": ") : null; },
                        });
                    });
                });
            },
        };
    },
};
