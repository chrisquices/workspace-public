// Own declaration boundaries only. Brace layout owns the first block child;
// existing CSS rule spacing owns boundaries between nested rules and at-rules.
import { cssStyleMessages, forEachVueStyleBlock } from "#eslint/helpers/for-each-vue-style-block.js";
import { isLineDirective } from "#eslint/helpers/is-line-directive.js";

export default {
    meta: {
        type: "layout",
        description: 'Put CSS declarations on separate consecutive lines in Vue style blocks.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            ...cssStyleMessages,
            declaration: "Start this CSS declaration on its own line. Keep consecutive declarations together without blank lines; preserve comments and multiline value contents.",
        },
    },

    create(context) {
        const source = context.sourceCode;
        return {
            Program() {
                forEachVueStyleBlock(context, function ({ root, offset }) {
                    const newline = root.source.input.css.match(/\r\n|\n|\r/u)?.[0] ?? "\n";
                    const directives = [];
                    root.walkComments(function (comment) {
                        if (isLineDirective({ value: comment.text }) || /stylelint-(?:disable|enable)-(?:next-line|line)\b/u.test(comment.text)) directives.push(comment);
                    });
                    root.walkDecls(function (node) {
                        const previous = node.prev();
                        if (!previous) return;
                        const before = node.raws.before ?? "";
                        const breaks = (before.match(/\r\n|\n|\r/gu) ?? []).length;
                        if (previous.type === "decl" ? breaks === 1 : breaks > 0) return;
                        const end = offset + node.source.start.offset;
                        const start = end - before.length;
                        let depth = 0;
                        for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) depth++;
                        const firstLine = source.getLocFromIndex(start).line;
                        const lastLine = source.getLocFromIndex(end).line;
                        const safe = /^[\t\f \r\n]*$/u.test(before) && source.text.slice(start, end) === before
                            && !directives.some(function (comment) {
                                const commentStart = source.getLocFromIndex(offset + comment.source.start.offset).line;
                                const commentEnd = source.getLocFromIndex(offset + comment.source.end.offset).line;
                                return firstLine <= commentEnd + 1 && lastLine >= commentStart - 1;
                            });
                        context.report({
                            loc: source.getLocFromIndex(end),
                            messageId: "declaration",
                            fix(fixer) { return safe ? fixer.replaceTextRange([start, end], newline + "    ".repeat(depth)) : null; },
                        });
                    });
                });
            },
        };
    },
};
