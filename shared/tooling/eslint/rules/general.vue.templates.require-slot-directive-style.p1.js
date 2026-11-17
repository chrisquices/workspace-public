import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
function normalizeOptions(options) {
    const normalized = {
        atComponent: "v-slot",
        default: "shorthand",
        named: "shorthand"
    };
    if (typeof options === "string") normalized.atComponent = normalized.default = normalized.named = options;
    else if (options != null) {
        for (const key of [
            "atComponent",
            "default",
            "named"
        ]) if (options[key] != null) normalized[key] = options[key];
    }
    return normalized;
}
function getExpectedStyle(options, node) {
    const { argument } = node.key;
    if (argument == null || argument.type === "VIdentifier" && argument.name === "default") return node.parent.parent.name === "template" ? options.default : options.atComponent;
    return options.named;
}
function getActualStyle(node) {
    const { name, argument } = node.key;
    if (name.rawName === "#") return "shorthand";
    return argument == null ? "v-slot" : "longform";
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use v-slot on components and shorthand on slot templates.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "expectedShorthand": "Expected '#{{argument}}' instead of '{{actual}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedLongform": "Expected 'v-slot:{{argument}}' instead of '{{actual}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedVSlot": "Expected 'v-slot' instead of '{{actual}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"atComponent":"v-slot","default":"shorthand","named":"shorthand"}];
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

        const sourceCode = context.sourceCode;
        const options = normalizeOptions(ruleOptions[0]);
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='slot']"(node) {
            const expected = getExpectedStyle(options, node);
            if (getActualStyle(node) === expected) return;
            const { name, argument } = node.key;
            const range = [name.range[0], (argument || name).range[1]];
            const argumentText = argument ? sourceCode.getText(argument) : "default";
            context.report({
                node,
                data: {
                    actual: sourceCode.text.slice(range[0], range[1]),
                    argument: argumentText
                },
                fix: safeFix(node, function (fixer) {
                    switch (expected) {
                        case "shorthand": return fixer.replaceTextRange(range, `#${argumentText}`);
                        case "longform": return fixer.replaceTextRange(range, `v-slot:${argumentText}`);
                        case "v-slot": return fixer.replaceTextRange(range, "v-slot");
                        default: return null;
                    }
                }),
                messageId: (`expected${require_casing.pascalCase(expected)}`) === "expectedShorthand" ? "expectedShorthand" : (`expected${require_casing.pascalCase(expected)}`) === "expectedLongform" ? "expectedLongform" : "expectedVSlot"
            });
        } });
    },
};
