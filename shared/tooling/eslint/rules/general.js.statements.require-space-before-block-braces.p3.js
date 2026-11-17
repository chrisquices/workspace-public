const { g: import_ast_utils, j: getSwitchCaseColonToken, z: isKeywordToken } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require space before block braces.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpace": "Unexpected space before opening brace." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpace": "Missing space before opening brace." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always"];
        const [config] = ruleOptions;
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

        const sourceCode = context.sourceCode;
        let alwaysFunctions = true;
        let alwaysKeywords = true;
        let alwaysClasses = true;
        let alwaysModules = true;
        let neverFunctions = false;
        let neverKeywords = false;
        let neverClasses = false;
        let neverModules = false;
        if (typeof config === "object") {
            alwaysFunctions = config.functions === "always";
            alwaysKeywords = config.keywords === "always";
            alwaysClasses = config.classes === "always";
            alwaysModules = config.modules === "always";
            neverFunctions = config.functions === "never";
            neverKeywords = config.keywords === "never";
            neverClasses = config.classes === "never";
            neverModules = config.modules === "never";
        } else if (config === "never") {
            alwaysFunctions = false;
            alwaysKeywords = false;
            alwaysClasses = false;
            alwaysModules = false;
            neverFunctions = true;
            neverKeywords = true;
            neverClasses = true;
            neverModules = true;
        }
        function isFunctionBody(node) {
            if (!("parent" in node)) return false;
            const parent = node.parent;
            return node.type === "BlockStatement" && (0, import_ast_utils.isFunction)(parent) && parent.body === node;
        }
        function isConflicted(precedingToken, node) {
            return (0, import_ast_utils.isArrowToken)(precedingToken) || isKeywordToken(precedingToken) && !isFunctionBody(node) || (0, import_ast_utils.isColonToken)(precedingToken) && "parent" in node && node.parent && node.parent.type === "SwitchCase" && precedingToken === getSwitchCaseColonToken(node.parent, sourceCode);
        }
        function checkPrecedingSpace(node) {
            const precedingToken = sourceCode.getTokenBefore(node);
            if (precedingToken && !isConflicted(precedingToken, node) && (0, import_ast_utils.isTokenOnSameLine)(precedingToken, node)) {
                const hasSpace = sourceCode.isSpaceBetween(precedingToken, node);
                let requireSpace;
                let requireNoSpace;
                if (isFunctionBody(node)) {
                    requireSpace = alwaysFunctions;
                    requireNoSpace = neverFunctions;
                } else if (node.type === "ClassBody" || node.type === "TSEnumBody" || node.type === "TSInterfaceBody") {
                    requireSpace = alwaysClasses;
                    requireNoSpace = neverClasses;
                } else if (node.type === "TSModuleBlock") {
                    requireSpace = alwaysModules;
                    requireNoSpace = neverModules;
                } else {
                    requireSpace = alwaysKeywords;
                    requireNoSpace = neverKeywords;
                }
                if (requireSpace && !hasSpace) context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        return fixer.insertTextBefore(node, " ");
                    }),
                    messageId: "missingSpace"
                });
                else if (requireNoSpace && hasSpace) context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        return fixer.removeRange([precedingToken.range[1], node.range[0]]);
                    }),
                    messageId: "unexpectedSpace"
                });
            }
        }
        return {
            BlockStatement: checkPrecedingSpace,
            ClassBody: checkPrecedingSpace,
            SwitchStatement(node) {
                const cases = node.cases;
                let openingBrace;
                if (cases.length > 0) openingBrace = sourceCode.getTokenBefore(cases[0]);
                else openingBrace = sourceCode.getLastToken(node, 1);
                checkPrecedingSpace(openingBrace);
            },
            TSEnumBody: checkPrecedingSpace,
            TSInterfaceBody: checkPrecedingSpace,
            TSModuleBlock: checkPrecedingSpace
        };
    },
};
