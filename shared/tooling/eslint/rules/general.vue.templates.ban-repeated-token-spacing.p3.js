import require_index from "eslint-plugin-vue/dist/utils/index.js";
import { extname } from "node:path";
const utils = require_index.default;
const isProperty = (context, node) => {
    const sourceCode = context.sourceCode;
    return node.type === "Punctuator" && sourceCode.getText(node) === ":";
};

export default {
    meta: {
        type: "layout",
        description: 'Avoid repeated spaces between Vue template tokens.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "multipleSpaces": "Multiple spaces found before '{{displayValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "useLatestParser": "Use the latest vue-eslint-parser. See also https://eslint.vuejs.org/user-guide/#what-is-the-use-the-latest-vue-eslint-parser-error." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"ignoreProperties":false,"ignoreEOLComments":false}];
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

                const result = change(fixer);
                if (!result) return null;
                const newline = sourceForFixes.text.match(/\r\n|\n|\r/u)?.[0] ?? "\n";
                const edits = (result.range ? [result] : [...result]).map(function (edit) {
                    return { range: edit.range, text: edit.text.replace(/\r\n|\n|\r/gu, newline) };
                });
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);
                    if (before.replace(/\s/gu, "") !== edit.text.replace(/\s/gu, "")) return null;
                    for (const comment of commentsForFixes) {
                        if (edit.range[0] < comment.range[1] && edit.range[1] > comment.range[0]
                            && !edit.text.includes(sourceForFixes.getText(comment))) return null;
                        if (/eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(comment.value)
                            && /[\r\n]/u.test(before + edit.text)) {
                            const first = sourceForFixes.getLocFromIndex(edit.range[0]).line;
                            const last = sourceForFixes.getLocFromIndex(edit.range[1]).line;
                            if (first <= comment.loc.end.line + 1 && last >= comment.loc.start.line - 1) return null;
                        }
                    }
                }
                return edits;
            };
        }

        const options = ruleOptions[0] || {};
        const shouldIgnoreProperties = options.ignoreProperties === true;
        const shouldIgnoreEOLComments = options.ignoreEOLComments === true;
        return { Program(node) {
            const sourceCode = context.sourceCode;
            if (sourceCode.parserServices.getTemplateBodyTokenStore == null) {
                const filename = context.filename;
                if (extname(filename) === ".vue") context.report({
                    loc: {
                        line: 1,
                        column: 0
                    },
                    messageId: "useLatestParser"
                });
                return;
            }
            const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore();
            const documentFragment = sourceCode.parserServices.getDocumentFragment && sourceCode.parserServices.getDocumentFragment();
            if (!documentFragment) return;
            const tokenLists = [];
            for (const element of documentFragment.children) {
                if (!utils.isVElement(element)) continue;
                if (element === node.templateBody) tokenLists.push(tokenStore.getTokens(element, { includeComments: true }));
                else {
                    tokenLists.push(tokenStore.getTokens(element.startTag));
                    if (element.endTag) tokenLists.push(tokenStore.getTokens(element.endTag));
                }
            }
            for (const tokens of tokenLists) {
                let prevToken = tokens.shift();
                for (const token of tokens) {
                    const spaces = token.range[0] - prevToken.range[1];
                    let shouldIgnore = shouldIgnoreProperties && (isProperty(context, token) || isProperty(context, prevToken));
                    if (!shouldIgnore && shouldIgnoreEOLComments && (token.type === "Line" || token.type === "Block")) {
                        const nextToken = tokenStore.getTokenAfter(token, { includeComments: true });
                        if (!nextToken || nextToken.loc.start.line > token.loc.end.line) shouldIgnore = true;
                    }
                    if (!shouldIgnore && spaces > 1 && token.loc.start.line === prevToken.loc.start.line) context.report({
                        node: token,
                        loc: {
                            start: prevToken.loc.end,
                            end: token.loc.start
                        },
                        fix: safeFix(token, (fixer) => fixer.replaceTextRange([prevToken.range[1], token.range[0]], " ")),
                        data: { displayValue: sourceCode.getText(token) },
                        messageId: "multipleSpaces"
                    });
                    prevToken = token;
                }
            }
        } };
    },
};
