// Format existing style attributes without adding scoped, lang, or module.
// Preserve attribute order, encoded values, and the stylesheet itself.
import { getVueBlocks } from '#eslint/helpers/get-vue-blocks.js';
import { isLineDirective } from "#eslint/helpers/is-line-directive.js";

export default {
    meta: {
        type: "layout",
        description: 'Keep Vue style opening tags on one line with single attribute spacing and double-quoted values.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            format: "Write this style opening tag as {{expected}}. Preserve the existing attributes, their order and values, and the stylesheet contents.",
            manual: "Format this style opening tag on one line with single attribute spacing and double-quoted values. Preserve multiline values, comments, directives, and attribute behavior; resolve ambiguous syntax manually.",
        },
    },

    create(context) {
        const vue = getVueBlocks(context);
        if (!vue) return {};
        const source = context.sourceCode;
        const document = source.parserServices.getDocumentFragment();
        const comments = [...source.getAllComments(), ...(document.comments ?? [])];

        return {
            Program() {
                for (const block of vue.blocks) {
                    if (block.rawName !== "style") continue;
                    const attributes = block.startTag.attributes;
                    const names = attributes.map(function (attribute) { return source.getText(attribute.key); });
                    let safe = vue.canFixStructure && new Set(names).size === names.length;
                    const formatted = attributes.map(function (attribute, index) {
                        const name = names[index];
                        if (attribute.directive || /\s/u.test(name)) safe = false;
                        if (!attribute.value) return name;
                        const raw = source.getText(attribute.value);
                        const quoted = raw[0] === "\"" || raw[0] === "'";
                        if (quoted && raw.at(-1) !== raw[0]) safe = false;
                        const value = quoted ? raw.slice(1, -1) : raw;
                        if (/[\r\n\u2028\u2029]/u.test(value)) safe = false;
                        return `${name}="${value.replaceAll("\"", "&quot;")}"`;
                    });
                    const ending = block.startTag.selfClosing ? " />" : ">";
                    const expected = `<style${formatted.length ? " " + formatted.join(" ") : ""}${ending}`;
                    if (source.getText(block.startTag) === expected && !/[\r\n\u2028\u2029]/u.test(expected)) continue;

                    if (block.startTag.loc.start.line !== block.startTag.loc.end.line
                        && comments.some(function (comment) {
                            return isLineDirective(comment) && comment.loc.end.line + 1 >= block.startTag.loc.start.line
                                && comment.loc.start.line - 1 <= block.startTag.loc.end.line;
                        })) safe = false;

                    context.report({
                        loc: block.startTag.loc,
                        messageId: safe ? "format" : "manual",
                        data: { expected: expected },
                        fix(fixer) { return safe ? fixer.replaceText(block.startTag, expected) : null; },
                    });
                }
            },
        };
    },
};
