// PostCSS raws locate real block braces, including nested rules and at-rules.
// Never scan selector strings or custom-property values for brace characters.
import { cssStyleMessages, forEachVueStyleBlock } from "#eslint/helpers/for-each-vue-style-block.js";
import { isLineDirective } from "#eslint/helpers/is-line-directive.js";

export default {
    meta: {
        type: "layout",
        description: 'Use spaced opening braces and unpadded multiline CSS blocks in Vue styles.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            ...cssStyleMessages,
            opening: "Place this CSS opening brace one space after its selector or at-rule header. Preserve header contents and comments.",
            body: "Start this nonempty CSS block on the next line and place its closing brace on a separate line, without blank padding inside the braces. Preserve declarations, comments, and literal values.",
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
                        if (isLineDirective({ value: comment.text }) || /stylelint-(?:disable|enable)-(?:next-line|line)\b/u.test(comment.text)) {
                            directives.push(comment);
                        }
                    });

                    function reportGap(range, expected, messageId) {
                        const current = source.text.slice(...range);
                        if (current === expected) return;
                        const firstLine = source.getLocFromIndex(range[0]).line;
                        const lastLine = source.getLocFromIndex(range[1]).line;
                        const changesLines = (current.match(/\r\n|\n|\r/gu) ?? []).length !== (expected.match(/\r\n|\n|\r/gu) ?? []).length;
                        const safe = /^[\t\f \r\n]*$/u.test(current) && (!changesLines || !directives.some(function (comment) {
                            const start = source.getLocFromIndex(offset + comment.source.start.offset).line;
                            const end = source.getLocFromIndex(offset + comment.source.end.offset).line;
                            return firstLine <= end + 1 && lastLine >= start - 1;
                        }));
                        context.report({
                            loc: { start: source.getLocFromIndex(range[0]), end: source.getLocFromIndex(range[1]) },
                            messageId: messageId === "opening" ? "opening" : "body",
                            fix(fixer) { return safe ? fixer.replaceTextRange(range, expected) : null; },
                        });
                    }

                    root.walk(function (node) {
                        if (!["rule", "atrule"].includes(node.type) || !node.nodes) return;
                        const close = offset + node.source.end.offset - (node.raws.ownSemicolon?.length ?? 0) - 1;
                        const after = node.raws.after ?? "";
                        const first = node.nodes[0];
                        const open = first
                            ? offset + first.source.start.offset - (first.raws.before?.length ?? 0) - 1
                            : close - after.length - 1;
                        if (source.text[open] !== "{" || source.text[close] !== "}") return;
                        const between = node.raws.between ?? "";
                        reportGap([open - between.length, open], " ", "opening");
                        if (!first) return;
                        let depth = 0;
                        for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) depth++;
                        reportGap([open + 1, offset + first.source.start.offset], newline + "    ".repeat(depth + 1), "body");
                        const last = node.nodes.at(-1);
                        const lastEnd = offset + last.source.end.offset;
                        // Unterminated custom properties can own whitespace up to
                        // the closing brace. Semicolon insertion must happen first.
                        if (last.type === "decl" && last.prop.startsWith("--") && source.text[lastEnd - 1] !== ";") return;
                        reportGap([close - after.length, close], newline + "    ".repeat(depth), "body");
                    });
                });
            },
        };
    },
};
