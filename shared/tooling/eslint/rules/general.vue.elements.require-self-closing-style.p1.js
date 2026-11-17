import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const ELEMENT_TYPE_MESSAGES = Object.freeze({
    NORMAL: "HTML elements",
    VOID: "HTML void elements",
    COMPONENT: "Vue.js custom components",
    SVG: "SVG elements",
    MATH: "MathML elements",
    UNKNOWN: "unknown elements"
});
function parseOptions(options) {
    return {
        NORMAL: options && options.html && options.html.normal || "always",
        VOID: options && options.html && options.html.void || "never",
        COMPONENT: options && options.html && options.html.component || "always",
        SVG: options && options.svg || "always",
        MATH: options && options.math || "always",
        UNKNOWN: null
    };
}
function getElementType(node) {
    if (utils.isCustomComponent(node) || utils.isVueBuiltInElementName(node.rawName)) return "COMPONENT";
    if (utils.isHtmlElementNode(node)) return utils.isHtmlVoidElementName(node.name) ? "VOID" : "NORMAL";
    if (utils.isSvgElementNode(node)) return "SVG";
    return utils.isMathElementNode(node) ? "MATH" : "UNKNOWN";
}
function isEmpty(node, sourceCode) {
    const start = node.startTag.range[1];
    const end = node.endTag == null ? node.range[1] : node.endTag.range[0];
    return sourceCode.text.slice(start, end).trim() === "";
}

export default {
    meta: {
        type: "layout",
        description: 'Self-close empty normal elements and components; leave HTML void elements without a self-closing slash.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "requireSelfClosing": "Require self-closing on {{elementType}} (<{{name}}>)." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowSelfClosing": "Disallow self-closing on {{elementType}} (<{{name}}/>)." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"html":{"normal":"always","component":"always","void":"never"},"svg":"always","math":"always"}];
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const element = target?.type === "VElement" ? target : target?.parent;
                for (let owner = element; owner?.type === "VElement"; owner = owner.parent) {
                    if (["pre", "textarea"].includes(owner.name) || owner.startTag.attributes.some(function (attribute) {
                        return attribute.directive && attribute.key.name.name === "pre";
                    })) return null;
                }
                const result = change(fixer);
                if (!result) return null;
                const edits = result.range ? [result] : [...result];
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);

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

        const sourceCode = context.sourceCode;
        const options = parseOptions(ruleOptions[0]);
        let hasInvalidEOF = false;
        return utils.defineTemplateBodyVisitor(context, { VElement(node) {
            if (hasInvalidEOF || node.parent.type === "VDocumentFragment") return;
            const elementType = getElementType(node);
            const mode = options[elementType];
            if (mode === "always" && !node.startTag.selfClosing && isEmpty(node, sourceCode)) context.report({
                node: node.endTag || node,
                data: {
                    elementType: ELEMENT_TYPE_MESSAGES[elementType],
                    name: node.rawName
                },
                fix: safeFix(node.endTag || node, function (fixer) {
                    const close = sourceCode.parserServices.getTemplateBodyTokenStore().getLastToken(node.startTag);
                    return close.type === "HTMLTagClose" ? fixer.replaceTextRange([close.range[0], node.range[1]], "/>") : null;
                }),
                messageId: "requireSelfClosing"
            });
            if (mode === "never" && node.startTag.selfClosing) context.report({
                node,
                loc: {
                    start: {
                        line: node.loc.end.line,
                        column: node.loc.end.column - 2
                    },
                    end: node.loc.end
                },
                data: {
                    elementType: ELEMENT_TYPE_MESSAGES[elementType],
                    name: node.rawName
                },
                fix: safeFix(node, function (fixer) {
                    const close = sourceCode.parserServices.getTemplateBodyTokenStore().getLastToken(node.startTag);
                    if (close.type !== "HTMLSelfClosingTagClose") return null;
                    if (elementType === "VOID") return fixer.replaceText(close, ">");
                    const elementPart = sourceCode.text.slice(node.range[0], close.range[0]);
                    return fixer.replaceText(node, `${elementPart}></${node.rawName}>`);
                }),
                messageId: "disallowSelfClosing"
            });
        } }, { Program(node) {
            hasInvalidEOF = utils.hasInvalidEOF(node);
        } });
    },
};
