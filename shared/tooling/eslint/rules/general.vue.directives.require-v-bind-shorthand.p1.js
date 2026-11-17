import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
function kebabCaseToCamelCase(name) {
    return require_casing.isKebabCase(name) ? require_casing.camelCase(name) : name;
}
function isSameName(node) {
    const attrName = node.key.argument.type === "VIdentifier" ? node.key.argument.rawName : null;
    const valueName = node.value?.expression?.type === "Identifier" ? node.value.expression.name : null;
    return attrName !== null && valueName !== null && kebabCaseToCamelCase(attrName) === kebabCaseToCamelCase(valueName);
}
function getCutStart(key) {
    return (key.modifiers.at(-1) || key.argument).range[1];
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use : shorthand for v-bind directives with arguments.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "expectedLonghand": "Expected 'v-bind' before ':'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedLonghand": "Unexpected 'v-bind' before ':'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedLonghandForProp": "Expected 'v-bind:' instead of '.'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedShorthand": "Expected same-name shorthand." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedShorthand": "Unexpected same-name shorthand." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["shorthand",{"sameNameShorthand":"ignore"}];
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

        const shouldPreferShorthand = ruleOptions[0] !== "longform";
        const sameNameShorthand = ruleOptions[1]?.sameNameShorthand || "ignore";
        function checkAttributeStyle(node) {
            const isShorthandProp = node.key.name.rawName === ".";
            if ((node.key.name.rawName === ":" || isShorthandProp) === shouldPreferShorthand) return;
            let messageId = "expectedLonghand";
            if (shouldPreferShorthand) messageId = "unexpectedLonghand";
            else if (isShorthandProp) messageId = "expectedLonghandForProp";
            context.report({
                node,
                loc: node.loc,
                fix: safeFix(node, function* (fixer) {
                    if (shouldPreferShorthand) yield fixer.remove(node.key.name);
                    else {
                        yield fixer.insertTextBefore(node, "v-bind");
                        if (isShorthandProp) {
                            yield fixer.replaceText(node.key.name, ":");
                            const modifier = node.key.modifiers[0];
                            if (modifier.name === "prop" && modifier.rawName === "") yield fixer.insertTextBefore(modifier, ".prop");
                        }
                    }
                }),
                messageId: (messageId) === "expectedLonghand" ? "expectedLonghand" : (messageId) === "unexpectedLonghand" ? "unexpectedLonghand" : (messageId) === "expectedLonghandForProp" ? "expectedLonghandForProp" : (messageId) === "expectedShorthand" ? "expectedShorthand" : "unexpectedShorthand"
            });
        }
        function checkAttributeSameName(node) {
            if (sameNameShorthand === "ignore" || !isSameName(node)) return;
            const isPreferShorthand = sameNameShorthand === "always";
            if (utils.isVBindSameNameShorthand(node) === isPreferShorthand) return;
            const messageId = isPreferShorthand ? "expectedShorthand" : "unexpectedShorthand";
            context.report({
                node,
                loc: node.loc,
                fix: safeFix(node, function* (fixer) {
                    if (isPreferShorthand) {
                        const valueRange = [getCutStart(node.key), node.range[1]];
                        yield fixer.removeRange(valueRange);
                    } else if (node.key.argument.type === "VIdentifier") yield fixer.insertTextAfter(node, `="${kebabCaseToCamelCase(node.key.argument.rawName)}"`);
                }),
                messageId: (messageId) === "expectedLonghand" ? "expectedLonghand" : (messageId) === "unexpectedLonghand" ? "unexpectedLonghand" : (messageId) === "expectedLonghandForProp" ? "expectedLonghandForProp" : (messageId) === "expectedShorthand" ? "expectedShorthand" : "unexpectedShorthand"
            });
        }
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='bind'][key.argument!=null]"(node) {
            checkAttributeSameName(node);
            checkAttributeStyle(node);
        } });
    },
};
