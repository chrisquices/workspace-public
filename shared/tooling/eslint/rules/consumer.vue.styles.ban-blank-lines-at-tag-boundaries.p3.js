// Trim only stylesheet boundary padding. PostCSS root.raws.after excludes
// whitespace owned by a trailing literal, comment, or custom-property value.
// Keep inline blocks and existing single line breaks unchanged.
import { cssStyleMessages, forEachVueStyleBlock } from "#eslint/helpers/for-each-vue-style-block.js";
import { isLineDirective } from "#eslint/helpers/is-line-directive.js";

export default {
    meta: {
        type: "layout",
        description: 'Remove excess blank lines at Vue style tag boundaries.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            ...cssStyleMessages,
            opening: "Remove blank lines immediately after the style opening tag. Keep one line break before the first CSS content or comment and preserve its indentation.",
            closing: "Remove blank lines immediately before the style closing tag. Keep one line break after the final CSS content or comment and preserve closing-tag indentation.",
            empty: "Remove excess blank lines from this empty style block, leaving one line break between its tags.",
            manual: "Remove excess blank lines before the style closing tag manually while preserving the target of the preceding line-sensitive comment directive.",
        },
    },

    create(context) {
        const source = context.sourceCode;

        function reportPadding(padding, start, boundary, canFix = true) {
            if (!/^[\t\f \r\n]*$/u.test(padding)) return;
            const breaks = [...padding.matchAll(/\r\n|\n|\r/gu)];
            if (breaks.length < 2) return;
            const end = start + padding.length;
            if (source.text.slice(start, end) !== padding) return;

            // Preserve horizontal whitespace on the first and last boundary
            // lines, and the first line ending's exact spelling.
            const first = breaks[0];
            const indentation = padding.match(/[\t\f ]*$/u)[0];
            const replacement = padding.slice(0, first.index) + first[0] + indentation;

            context.report({
                loc: { start: source.getLocFromIndex(start), end: source.getLocFromIndex(end) },
                messageId: !canFix ? "manual" : boundary === "opening" ? "opening" : boundary === "closing" ? "closing" : "empty",
                fix(fixer) { return canFix ? fixer.replaceTextRange([start, end], replacement) : null; },
            });
        }

        return {
            Program() {
                forEachVueStyleBlock(context, function ({ root, offset }) {
                    const css = root.source.input.css;
                    if (root.nodes.length === 0) {
                        reportPadding(css, offset, "empty");
                        return;
                    }

                    const leading = css.match(/^[\t\f \r\n]*/u)[0];
                    reportPadding(leading, offset, "opening");

                    const trailing = root.raws.after ?? "";
                    const last = root.last;
                    const followsLineDirective = last.type === "comment"
                        && (isLineDirective({ value: last.text })
                            || /stylelint-(?:disable|enable)-(?:next-line|line)\b/u.test(last.text));
                    reportPadding(trailing, offset + css.length - trailing.length, "closing", !followsLineDirective);
                });
            },
        };
    },
};
