const { H: isNumericLiteral, q: isStringLiteral, y: ES3_KEYWORDS } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
import { tokenize } from "espree";

export default {
    meta: {
        type: "layout",
        description: "Require consistent-as-needed property quotes.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "requireQuotesDueToReservedWord": "Properties should be quoted as '{{property}}' is a reserved word." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "inconsistentlyQuotedProperty": "Inconsistently quoted property '{{key}}' found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unnecessarilyQuotedProperty": "Unnecessarily quoted property '{{property}}' found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unquotedReservedProperty": "Unquoted reserved word '{{property}}' used as key." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unquotedNumericProperty": "Unquoted number literal '{{property}}' used as key." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unquotedPropertyFound": "Unquoted property '{{property}}' found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "redundantQuoting": "Properties shouldn't be quoted as all quotes are redundant." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["consistent-as-needed"];
        const [MODE, options = {}] = ruleOptions;
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

        const { keywords: KEYWORDS = false, unnecessary: CHECK_UNNECESSARY = true, numbers: NUMBERS = false } = options;
        const sourceCode = context.sourceCode;
        function isKeyword(tokenStr) {
            return ES3_KEYWORDS.includes(tokenStr);
        }
        function areQuotesRedundant(rawKey, tokens, skipNumberLiterals = false) {
            return tokens.length === 1 && tokens[0].start === 0 && tokens[0].end === rawKey.length && ([
                "Identifier",
                "Keyword",
                "Null",
                "Boolean"
            ].includes(tokens[0].type) || tokens[0].type === "Numeric" && !skipNumberLiterals && String(+tokens[0].value) === tokens[0].value);
        }
        function getUnquotedKey(key) {
            return key.type === "Identifier" ? key.name : key.value;
        }
        function getQuotedKey(key) {
            if (isStringLiteral(key)) return sourceCode.getText(key);
            return `"${key.type === "Identifier" ? key.name : key.value}"`;
        }
        function checkUnnecessaryQuotes(node) {
            if (node.type === "Property" && (node.method || node.computed || node.shorthand)) return;
            if (node.type !== "ImportAttribute" && node.computed) return;
            const key = node.type === "TSEnumMember" ? node.id : node.key;
            if (key.type === "Literal" && typeof key.value === "string") {
                let tokens;
                try {
                    tokens = tokenize(key.value);
                } catch {
                    return;
                }
                if (tokens.length !== 1) return;
                if (isKeyword(tokens[0].value) && KEYWORDS) return;
                if (CHECK_UNNECESSARY && areQuotesRedundant(key.value, tokens, NUMBERS)) context.report({
                    node,
                    data: { property: key.value },
                    fix: safeFix(node, (fixer) => fixer.replaceText(key, getUnquotedKey(key))),
                    messageId: "unnecessarilyQuotedProperty"
                });
            } else if (KEYWORDS && key.type === "Identifier" && isKeyword(key.name)) context.report({
                node,
                data: { property: key.name },
                fix: safeFix(node, (fixer) => fixer.replaceText(key, getQuotedKey(key))),
                messageId: "unquotedReservedProperty"
            });
            else if (NUMBERS && isNumericLiteral(key)) context.report({
                node,
                data: { property: key.value },
                fix: safeFix(node, (fixer) => fixer.replaceText(key, getQuotedKey(key))),
                messageId: "unquotedNumericProperty"
            });
        }
        function checkOmittedQuotes(node) {
            if (node.type === "Property" && (node.method || node.computed || node.shorthand)) return;
            if (node.type !== "ImportAttribute" && node.computed) return;
            const key = node.type === "TSEnumMember" ? node.id : node.key;
            if (key.type === "Literal" && typeof key.value === "string") return;
            context.report({
                node,
                data: { property: key.name || key.value },
                fix: safeFix(node, (fixer) => fixer.replaceText(key, getQuotedKey(key))),
                messageId: "unquotedPropertyFound"
            });
        }
        function checkConsistencyForObject(properties, checkQuotesRedundancy) {
            checkConsistency(properties.filter((property) => property.type !== "SpreadElement" && property.key && !property.method && !property.computed && !property.shorthand), checkQuotesRedundancy);
        }
        function checkImportAttributes(attributes) {
            if (!attributes) return;
            if (MODE === "consistent") checkConsistency(attributes, false);
            if (MODE === "consistent-as-needed") checkConsistency(attributes, true);
        }
        function checkConsistency(properties, checkQuotesRedundancy) {
            const quotedProps = [];
            const unquotedProps = [];
            let keywordKeyName = null;
            let necessaryQuotes = false;
            properties.forEach((property) => {
                const key = property.key;
                if (key.type === "Literal" && typeof key.value === "string") {
                    quotedProps.push(property);
                    if (checkQuotesRedundancy) {
                        let tokens;
                        try {
                            tokens = tokenize(key.value);
                        } catch {
                            necessaryQuotes = true;
                            return;
                        }
                        necessaryQuotes = necessaryQuotes || !areQuotesRedundant(key.value, tokens) || KEYWORDS && isKeyword(tokens[0].value);
                    }
                } else if (KEYWORDS && checkQuotesRedundancy && key.type === "Identifier" && isKeyword(key.name)) {
                    unquotedProps.push(property);
                    necessaryQuotes = true;
                    keywordKeyName = key.name;
                } else unquotedProps.push(property);
            });
            if (checkQuotesRedundancy && quotedProps.length && !necessaryQuotes) quotedProps.forEach((property) => {
                const key = property.key;
                context.report({
                    node: property,
                    fix: safeFix(property, (fixer) => fixer.replaceText(key, getUnquotedKey(key))),
                    messageId: "redundantQuoting"
                });
            });
            else if (unquotedProps.length && keywordKeyName) unquotedProps.forEach((property) => {
                context.report({
                    node: property,
                    data: { property: keywordKeyName },
                    fix: safeFix(property, (fixer) => fixer.replaceText(property.key, getQuotedKey(property.key))),
                    messageId: "requireQuotesDueToReservedWord"
                });
            });
            else if (quotedProps.length && unquotedProps.length) unquotedProps.forEach((property) => {
                context.report({
                    node: property,
                    data: { key: property.key.name || property.key.value },
                    fix: safeFix(property, (fixer) => fixer.replaceText(property.key, getQuotedKey(property.key))),
                    messageId: "inconsistentlyQuotedProperty"
                });
            });
        }
        return {
            Property(node) {
                if (MODE === "always" || !MODE) checkOmittedQuotes(node);
                if (MODE === "as-needed") checkUnnecessaryQuotes(node);
            },
            ObjectExpression(node) {
                if (MODE === "consistent") checkConsistencyForObject(node.properties, false);
                if (MODE === "consistent-as-needed") checkConsistencyForObject(node.properties, true);
            },
            ImportAttribute(node) {
                if (MODE === "always" || !MODE) checkOmittedQuotes(node);
                if (MODE === "as-needed") checkUnnecessaryQuotes(node);
            },
            ImportDeclaration(node) {
                checkImportAttributes(node.attributes);
            },
            ExportAllDeclaration(node) {
                checkImportAttributes(node.attributes);
            },
            ExportNamedDeclaration(node) {
                checkImportAttributes(node.attributes);
            },
            TSPropertySignature(node) {
                if (MODE === "always" || !MODE) checkOmittedQuotes(node);
                if (MODE === "as-needed") checkUnnecessaryQuotes(node);
            },
            TSEnumMember(node) {
                if (MODE === "always" || !MODE) checkOmittedQuotes(node);
                if (MODE === "as-needed") checkUnnecessaryQuotes(node);
            },
            TSTypeLiteral(node) {
                if (MODE === "consistent") checkConsistencyForObject(node.members, false);
                if (MODE === "consistent-as-needed") checkConsistencyForObject(node.members, true);
            },
            TSInterfaceBody(node) {
                if (MODE === "consistent") checkConsistencyForObject(node.body, false);
                if (MODE === "consistent-as-needed") checkConsistencyForObject(node.body, true);
            },
            TSEnumDeclaration(node) {
                const members = (node.body?.members || node.members).map((member) => ({
                    ...member,
                    key: member.id
                }));
                if (MODE === "consistent") checkConsistencyForObject(members, false);
                if (MODE === "consistent-as-needed") checkConsistencyForObject(members, true);
            }
        };
    },
};
