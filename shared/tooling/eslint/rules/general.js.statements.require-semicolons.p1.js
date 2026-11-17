const { K: isSingleLine, O: getNextLocation, g: import_ast_utils, m: AST_NODE_TYPES, t: FixTracker } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require semicolons.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "missingSemi": "Missing semicolon." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "extraSemi": "Extra semicolon." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always",{"omitLastInOneLineBlock":false,"omitLastInOneLineClassBody":false}];
        const [mode, options] = ruleOptions;
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

        const OPT_OUT_PATTERN = /^[-[(/+`]/u;
        const unsafeClassFieldNames = new Set([
            "get",
            "set",
            "static"
        ]);
        const unsafeClassFieldFollowers = new Set([
            "*",
            "in",
            "instanceof"
        ]);
        const never = mode === "never";
        const exceptOneLine = Boolean(options && "omitLastInOneLineBlock" in options && options.omitLastInOneLineBlock);
        const exceptOneLineClassBody = Boolean(options && "omitLastInOneLineClassBody" in options && options.omitLastInOneLineClassBody);
        const beforeStatementContinuationChars = options && "beforeStatementContinuationChars" in options && options.beforeStatementContinuationChars || "any";
        const sourceCode = context.sourceCode;
        function report(node, missing = false) {
            const lastToken = sourceCode.getLastToken(node);
            let messageId = "missingSemi";
            let fix, loc;
            if (!missing) {
                loc = {
                    start: lastToken.loc.end,
                    end: getNextLocation(sourceCode, lastToken.loc.end)
                };
                fix = function(fixer) {
                    return fixer.insertTextAfter(lastToken, ";");
                };
            } else {
                messageId = "extraSemi";
                loc = lastToken.loc;
                fix = function(fixer) {
                    return new FixTracker(fixer, sourceCode).retainSurroundingTokens(lastToken).remove(lastToken);
                };
            }
            context.report({
                node,
                loc,
                fix: safeFix(node, fix),
                messageId: (messageId) === "missingSemi" ? "missingSemi" : "extraSemi"
            });
        }
        function isRedundantSemi(semiToken) {
            const nextToken = sourceCode.getTokenAfter(semiToken);
            return !nextToken || (0, import_ast_utils.isClosingBraceToken)(nextToken) || (0, import_ast_utils.isSemicolonToken)(nextToken);
        }
        function isEndOfArrowBlock(lastToken) {
            if (!(0, import_ast_utils.isClosingBraceToken)(lastToken)) return false;
            const node = sourceCode.getNodeByRangeIndex(lastToken.range[0]);
            return node.type === "BlockStatement" && node.parent.type === "ArrowFunctionExpression";
        }
        function maybeClassFieldAsiHazard(node) {
            if (node.type !== "PropertyDefinition") return false;
            if (!node.computed && node.key.type === "Identifier" && "name" in node.key && unsafeClassFieldNames.has(node.key.name)) {
                if (!(node.static && node.key.name === "static") && !node.value) return true;
            }
            const followingToken = sourceCode.getTokenAfter(node);
            return unsafeClassFieldFollowers.has(followingToken.value);
        }
        function isOnSameLineWithNextToken(node) {
            const prevToken = sourceCode.getLastToken(node, 1);
            const nextToken = sourceCode.getTokenAfter(node);
            return !!nextToken && (0, import_ast_utils.isTokenOnSameLine)(prevToken, nextToken);
        }
        function maybeAsiHazardAfter(node) {
            const t = node.type;
            if (t === "DoWhileStatement" || t === "BreakStatement" || t === "ContinueStatement" || t === "DebuggerStatement" || t === "ImportDeclaration" || t === "ExportAllDeclaration") return false;
            if (t === "ReturnStatement") return Boolean(node.argument);
            if (t === "ExportNamedDeclaration") return Boolean(node.declaration);
            if (isEndOfArrowBlock(sourceCode.getLastToken(node, 1))) return false;
            return true;
        }
        function maybeAsiHazardBefore(token) {
            return Boolean(token) && OPT_OUT_PATTERN.test(token.value) && token.value !== "++" && token.value !== "--";
        }
        function canRemoveSemicolon(node) {
            if (isRedundantSemi(sourceCode.getLastToken(node))) return true;
            if (maybeClassFieldAsiHazard(node)) return false;
            if (isOnSameLineWithNextToken(node)) return false;
            if (node.type !== "PropertyDefinition" && beforeStatementContinuationChars === "never" && !maybeAsiHazardAfter(node)) return true;
            if (!maybeAsiHazardBefore(sourceCode.getTokenAfter(node))) return true;
            return false;
        }
        function isLastInOneLinerBlock(node) {
            const parent = node.parent;
            const nextToken = sourceCode.getTokenAfter(node);
            if (!nextToken || nextToken.value !== "}") return false;
            if (parent.type === "BlockStatement") return isSingleLine(parent);
            if (parent.type === "StaticBlock") return (0, import_ast_utils.isTokenOnSameLine)(parent, sourceCode.getFirstToken(parent, { skip: 1 }));
            return false;
        }
        function isLastInOneLinerClassBody(node) {
            const parent = node.parent;
            const nextToken = sourceCode.getTokenAfter(node);
            if (!nextToken || nextToken.value !== "}") return false;
            if (parent.type === "ClassBody") return isSingleLine(parent);
            return false;
        }
        function checkForSemicolon(node) {
            const isSemi = (0, import_ast_utils.isSemicolonToken)(sourceCode.getLastToken(node));
            if (never) {
                const nextToken = sourceCode.getTokenAfter(node);
                if (isSemi && canRemoveSemicolon(node)) report(node, true);
                else if (!isSemi && beforeStatementContinuationChars === "always" && node.type !== "PropertyDefinition" && maybeAsiHazardBefore(nextToken)) report(node);
            } else {
                const oneLinerBlock = exceptOneLine && isLastInOneLinerBlock(node);
                const oneLinerClassBody = exceptOneLineClassBody && isLastInOneLinerClassBody(node);
                const oneLinerBlockOrClassBody = oneLinerBlock || oneLinerClassBody;
                if (isSemi && oneLinerBlockOrClassBody) report(node, true);
                else if (!isSemi && !oneLinerBlockOrClassBody) report(node);
            }
        }
        return {
            VariableDeclaration(node) {
                const parent = node.parent;
                if ((parent.type !== "ForStatement" || parent.init !== node) && (!/^For(?:In|Of)Statement/u.test(parent.type) || parent.left !== node)) checkForSemicolon(node);
            },
            ExpressionStatement: checkForSemicolon,
            ReturnStatement: checkForSemicolon,
            ThrowStatement: checkForSemicolon,
            DoWhileStatement: checkForSemicolon,
            DebuggerStatement: checkForSemicolon,
            BreakStatement: checkForSemicolon,
            ContinueStatement: checkForSemicolon,
            ImportDeclaration: checkForSemicolon,
            ExportAllDeclaration: checkForSemicolon,
            ExportNamedDeclaration(node) {
                if (!node.declaration) checkForSemicolon(node);
            },
            ExportDefaultDeclaration(node) {
                if (node.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) return;
                if (!/(?:Class|Function)Declaration/u.test(node.declaration.type)) checkForSemicolon(node);
            },
            PropertyDefinition: checkForSemicolon,
            AccessorProperty: checkForSemicolon,
            TSAbstractPropertyDefinition: checkForSemicolon,
            TSDeclareFunction: checkForSemicolon,
            TSExportAssignment: checkForSemicolon,
            TSImportEqualsDeclaration: checkForSemicolon,
            TSTypeAliasDeclaration: checkForSemicolon,
            TSEmptyBodyFunctionExpression: checkForSemicolon
        };
    },
};
