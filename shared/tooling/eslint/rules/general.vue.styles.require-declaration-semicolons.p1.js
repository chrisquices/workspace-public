// PostCSS end offsets are exclusive and include an existing semicolon.
// Add punctuation at that parsed boundary, never inside a value or comment.
import { cssStyleMessages, forEachVueStyleBlock } from "#eslint/helpers/for-each-vue-style-block.js";

export default {
    meta: {
        type: "layout",
        description: 'End every CSS declaration in Vue style blocks with a semicolon.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            ...cssStyleMessages,
            semicolon: "Terminate this CSS declaration with a semicolon, including when it is the final declaration in a block. Preserve its value and comments.",
        },
    },

    create(context) {
        const source = context.sourceCode;
        return {
            Program() {
                forEachVueStyleBlock(context, function ({ root, offset }) {
                    root.walkDecls(function (node) {
                        const end = offset + node.source.end.offset;
                        if (source.text[end - 1] === ";") return;
                        context.report({
                            loc: source.getLocFromIndex(end),
                            messageId: "semicolon",
                            fix(fixer) { return fixer.insertTextAfterRange([end, end], ";"); },
                        });
                    });
                });
            },
        };
    },
};
