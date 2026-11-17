import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
const allowedCaseOptions = ["PascalCase", "kebab-case"];
function canConvert(node) {
    return node.type === "Literal" || node.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use PascalCase for Vue component names.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "incorrectCase": "Property name \"{{value}}\" is not {{caseType}}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["PascalCase"];
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

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

        const options = ruleOptions[0];
        const caseType = allowedCaseOptions.includes(options) ? options : "PascalCase";
        function convertName(node) {
            let nodeValue;
            let range;
            if (node.type === "TemplateLiteral") {
                const quasis = node.quasis[0];
                nodeValue = quasis.value.cooked;
                range = quasis.range;
            } else {
                nodeValue = String(node.value);
                range = node.range;
            }
            if (!require_casing.getChecker(caseType)(nodeValue)) context.report({
                node,
                data: {
                    value: nodeValue,
                    caseType
                },
                fix: safeFix(node, (fixer) => fixer.replaceTextRange([range[0] + 1, range[1] - 1], require_casing.getExactConverter(caseType)(nodeValue))),
                messageId: "incorrectCase"
            });
        }
        return utils.compositingVisitors(utils.executeOnCallVueComponent(context, (node) => {
            if (node.arguments.length !== 2) return;
            const argument = node.arguments[0];
            if (canConvert(argument)) convertName(argument);
        }), utils.executeOnVue(context, (obj) => {
            const node = utils.findProperty(obj, "name");
            if (!node || !canConvert(node.value)) return;
            convertName(node.value);
        }), utils.defineScriptSetupVisitor(context, { onDefineOptionsEnter(node) {
            if (node.arguments.length === 0) return;
            const define = node.arguments[0];
            if (define.type !== "ObjectExpression") return;
            const nameNode = utils.findProperty(define, "name");
            if (!nameNode || !canConvert(nameNode.value)) return;
            convertName(nameNode.value);
        } }));
    },
};
