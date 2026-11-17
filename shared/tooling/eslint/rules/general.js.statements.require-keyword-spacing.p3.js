const { b: KEYWORDS, g: import_ast_utils, m: AST_NODE_TYPES, z: isKeywordToken } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const PREV_TOKEN = /^[)\]}>]$/u;
const NEXT_TOKEN = /^(?:[([{<~!]|\+\+?|--?)$/u;
const PREV_TOKEN_M = /^[)\]}>*]$/u;
const NEXT_TOKEN_M = /^[{*]$/u;
const TEMPLATE_OPEN_PAREN = /\$\{$/u;
const TEMPLATE_CLOSE_PAREN = /^\}/u;
const CHECK_TYPE = /^(?:JSXElement|RegularExpression|String|Template|PrivateIdentifier)$/u;

export default {
    meta: {
        type: "layout",
        description: "Require keyword spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedBefore": "Expected space(s) before \"{{value}}\"." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedAfter": "Expected space(s) after \"{{value}}\"." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedBefore": "Unexpected space(s) before \"{{value}}\"." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space(s) after \"{{value}}\"." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"before":true,"after":true,"overrides":{}}];
        const [options] = ruleOptions;
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
        const tokensToIgnore = new WeakSet();
        function isOpenParenOfTemplate(token) {
            return token.type === "Template" && TEMPLATE_OPEN_PAREN.test(token.value);
        }
        function isCloseParenOfTemplate(token) {
            return token.type === "Template" && TEMPLATE_CLOSE_PAREN.test(token.value);
        }
        function expectSpaceBefore(token, pattern) {
            const prevToken = sourceCode.getTokenBefore(token);
            if (prevToken && (CHECK_TYPE.test(prevToken.type) || pattern.test(prevToken.value)) && !isOpenParenOfTemplate(prevToken) && !tokensToIgnore.has(prevToken) && (0, import_ast_utils.isTokenOnSameLine)(prevToken, token) && !sourceCode.isSpaceBetween(prevToken, token)) context.report({
                loc: token.loc,
                data: token,
                fix: safeFix(null, function (fixer) {
                    return fixer.insertTextBefore(token, " ");
                }),
                messageId: "expectedBefore"
            });
        }
        function unexpectSpaceBefore(token, pattern) {
            const prevToken = sourceCode.getTokenBefore(token);
            if (prevToken && (CHECK_TYPE.test(prevToken.type) || pattern.test(prevToken.value)) && !isOpenParenOfTemplate(prevToken) && !tokensToIgnore.has(prevToken) && (0, import_ast_utils.isTokenOnSameLine)(prevToken, token) && sourceCode.isSpaceBetween(prevToken, token)) context.report({
                loc: {
                    start: prevToken.loc.end,
                    end: token.loc.start
                },
                data: token,
                fix: safeFix(null, function (fixer) {
                    return fixer.removeRange([prevToken.range[1], token.range[0]]);
                }),
                messageId: "unexpectedBefore"
            });
        }
        function expectSpaceAfter(token, pattern) {
            const nextToken = sourceCode.getTokenAfter(token);
            if (nextToken && (CHECK_TYPE.test(nextToken.type) || pattern.test(nextToken.value)) && !isCloseParenOfTemplate(nextToken) && !tokensToIgnore.has(nextToken) && (0, import_ast_utils.isTokenOnSameLine)(token, nextToken) && !sourceCode.isSpaceBetween(token, nextToken)) context.report({
                loc: token.loc,
                data: token,
                fix: safeFix(null, function (fixer) {
                    return fixer.insertTextAfter(token, " ");
                }),
                messageId: "expectedAfter"
            });
        }
        function unexpectSpaceAfter(token, pattern) {
            const nextToken = sourceCode.getTokenAfter(token);
            if (nextToken && (CHECK_TYPE.test(nextToken.type) || pattern.test(nextToken.value)) && !isCloseParenOfTemplate(nextToken) && !tokensToIgnore.has(nextToken) && (0, import_ast_utils.isTokenOnSameLine)(token, nextToken) && sourceCode.isSpaceBetween(token, nextToken)) context.report({
                loc: {
                    start: token.loc.end,
                    end: nextToken.loc.start
                },
                data: token,
                fix: safeFix(null, function (fixer) {
                    return fixer.removeRange([token.range[1], nextToken.range[0]]);
                }),
                messageId: "unexpectedAfter"
            });
        }
        function parseOptions(options) {
            const { before, after, overrides } = options;
            const defaultValue = {
                before: before ? expectSpaceBefore : unexpectSpaceBefore,
                after: after ? expectSpaceAfter : unexpectSpaceAfter
            };
            const retv = Object.create(null);
            for (let i = 0; i < KEYWORDS.length; ++i) {
                const key = KEYWORDS[i];
                const override = overrides[key];
                if (override) {
                    const thisBefore = "before" in override ? override.before : before;
                    const thisAfter = "after" in override ? override.after : after;
                    retv[key] = {
                        before: thisBefore ? expectSpaceBefore : unexpectSpaceBefore,
                        after: thisAfter ? expectSpaceAfter : unexpectSpaceAfter
                    };
                } else retv[key] = defaultValue;
            }
            return retv;
        }
        const checkMethodMap = parseOptions(options);
        function checkSpacingBefore(token, pattern) {
            checkMethodMap[token.value].before(token, pattern || PREV_TOKEN);
        }
        function checkSpacingAfter(token, pattern) {
            checkMethodMap[token.value].after(token, pattern || NEXT_TOKEN);
        }
        function checkSpacingAround(token) {
            checkSpacingBefore(token);
            checkSpacingAfter(token);
        }
        function checkSpacingAroundFirstToken(node) {
            const firstToken = node && sourceCode.getFirstToken(node);
            if (!firstToken) return;
            if (!isKeywordToken(firstToken)) if (node.type === "VariableDeclaration") {
                if (node.kind !== "using" && node.kind !== "await using" || firstToken.type !== "Identifier") return;
            } else return;
            checkSpacingAround(firstToken);
        }
        function checkSpacingBeforeFirstToken(node) {
            const firstToken = node && sourceCode.getFirstToken(node);
            if (isKeywordToken(firstToken)) checkSpacingBefore(firstToken);
        }
        function checkSpacingAroundTokenBefore(node) {
            if (node) {
                const token = sourceCode.getTokenBefore(node, isKeywordToken);
                if (token) checkSpacingAround(token);
            }
        }
        function checkSpacingForFunction(node) {
            const firstToken = node && sourceCode.getFirstToken(node);
            if (firstToken && (isKeywordToken(firstToken) && firstToken.value === "function" || firstToken.value === "async")) checkSpacingBefore(firstToken);
        }
        function checkSpacingForClass(node) {
            checkSpacingAroundFirstToken(node);
            checkSpacingAroundTokenBefore(node.superClass);
        }
        function checkSpacingForModuleDeclaration(node) {
            const firstToken = sourceCode.getFirstToken(node);
            checkSpacingBefore(firstToken, PREV_TOKEN_M);
            checkSpacingAfter(firstToken, NEXT_TOKEN_M);
            if (node.type === "ExportDefaultDeclaration") checkSpacingAround(sourceCode.getTokenAfter(firstToken));
            if (node.type === "ExportAllDeclaration" && node.exported) {
                const asToken = sourceCode.getTokenBefore(node.exported);
                checkSpacingBefore(asToken, PREV_TOKEN_M);
                checkSpacingAfter(asToken, NEXT_TOKEN_M);
            }
            if ("source" in node && node.source) {
                const fromToken = sourceCode.getTokenBefore(node.source);
                checkSpacingBefore(fromToken, PREV_TOKEN_M);
                checkSpacingAfter(fromToken, NEXT_TOKEN_M);
                if (node.attributes) {
                    const withToken = sourceCode.getTokenAfter(node.source);
                    if (isKeywordToken(withToken)) checkSpacingAround(withToken);
                }
            }
            if (node.type !== "ExportDefaultDeclaration") checkSpacingForTypeKeywordInImportExport(node);
        }
        function checkSpacingForTypeKeywordInImportExport(node) {
            let kind;
            switch (node.type) {
                case AST_NODE_TYPES.ImportDeclaration:
                    kind = node.importKind;
                    break;
                case AST_NODE_TYPES.ExportAllDeclaration:
                case AST_NODE_TYPES.ExportNamedDeclaration:
                    kind = node.exportKind;
                    break;
            }
            if (kind !== "type") return;
            const typeToken = sourceCode.getFirstToken(node, { skip: 1 });
            if (!(0, import_ast_utils.isTypeKeyword)(typeToken)) return;
            checkSpacingBefore(typeToken, PREV_TOKEN_M);
            checkSpacingAfter(typeToken, NEXT_TOKEN_M);
        }
        function checkSpacingForProperty(node) {
            if ("static" in node && node.static) checkSpacingAroundFirstToken(node);
            if (node.kind === "get" || node.kind === "set" || ("method" in node && node.method || node.type === "MethodDefinition") && "async" in node.value && node.value.async || node.type === AST_NODE_TYPES.AccessorProperty) {
                const token = sourceCode.getTokenBefore(node.key, (tok) => {
                    switch (tok.value) {
                        case "get":
                        case "set":
                        case "async":
                        case "accessor": return true;
                        default: return false;
                    }
                });
                if (!token) throw new Error("Failed to find token get, set, or async beside method name");
                checkSpacingAround(token);
            }
        }
        return {
            DebuggerStatement: checkSpacingAroundFirstToken,
            WithStatement: checkSpacingAroundFirstToken,
            BreakStatement: checkSpacingAroundFirstToken,
            ContinueStatement: checkSpacingAroundFirstToken,
            ReturnStatement: checkSpacingAroundFirstToken,
            ThrowStatement: checkSpacingAroundFirstToken,
            TryStatement(node) {
                checkSpacingAroundFirstToken(node);
                if (node.handler) if (node.handler.param) checkSpacingBeforeFirstToken(node.handler);
                else checkSpacingAroundFirstToken(node.handler);
                checkSpacingAroundTokenBefore(node.finalizer);
            },
            IfStatement(node) {
                checkSpacingAroundFirstToken(node);
                checkSpacingAroundTokenBefore(node.alternate);
            },
            SwitchStatement: checkSpacingAroundFirstToken,
            SwitchCase: checkSpacingAroundFirstToken,
            DoWhileStatement(node) {
                checkSpacingAroundFirstToken(node);
                checkSpacingAroundTokenBefore(node.test);
            },
            ForInStatement(node) {
                checkSpacingAroundFirstToken(node);
                const inToken = sourceCode.getTokenBefore(node.right, import_ast_utils.isNotOpeningParenToken);
                if (sourceCode.getTokenBefore(inToken).type !== "PrivateIdentifier") checkSpacingBefore(inToken);
                checkSpacingAfter(inToken);
            },
            ForOfStatement(node) {
                if (node.await) {
                    checkSpacingBefore(sourceCode.getFirstToken(node, 0));
                    checkSpacingAfter(sourceCode.getFirstToken(node, 1));
                } else checkSpacingAroundFirstToken(node);
                const ofToken = sourceCode.getTokenBefore(node.right, import_ast_utils.isNotOpeningParenToken);
                if (sourceCode.getTokenBefore(ofToken).type !== "PrivateIdentifier") checkSpacingBefore(ofToken);
                checkSpacingAfter(ofToken);
            },
            ForStatement: checkSpacingAroundFirstToken,
            WhileStatement: checkSpacingAroundFirstToken,
            ClassDeclaration: checkSpacingForClass,
            ExportNamedDeclaration: checkSpacingForModuleDeclaration,
            ExportDefaultDeclaration: checkSpacingForModuleDeclaration,
            ExportAllDeclaration: checkSpacingForModuleDeclaration,
            FunctionDeclaration: checkSpacingForFunction,
            ImportDeclaration: checkSpacingForModuleDeclaration,
            VariableDeclaration: checkSpacingAroundFirstToken,
            ArrowFunctionExpression: checkSpacingForFunction,
            AwaitExpression(node) {
                checkSpacingBefore(sourceCode.getFirstToken(node));
            },
            ClassExpression: checkSpacingForClass,
            FunctionExpression: checkSpacingForFunction,
            NewExpression: checkSpacingBeforeFirstToken,
            Super: checkSpacingBeforeFirstToken,
            ThisExpression: checkSpacingBeforeFirstToken,
            UnaryExpression: checkSpacingBeforeFirstToken,
            YieldExpression: checkSpacingBeforeFirstToken,
            ImportSpecifier(node) {
                if (node.imported.range[0] !== node.local.range[0]) checkSpacingBefore(sourceCode.getTokenBefore(node.local), PREV_TOKEN_M);
            },
            ExportSpecifier(node) {
                if (node.local.range[0] !== node.exported.range[0]) {
                    const asToken = sourceCode.getTokenBefore(node.exported);
                    checkSpacingBefore(asToken, PREV_TOKEN_M);
                    checkSpacingAfter(asToken, NEXT_TOKEN_M);
                }
            },
            ImportNamespaceSpecifier(node) {
                checkSpacingBefore(sourceCode.getFirstToken(node, 1), PREV_TOKEN_M);
            },
            MethodDefinition: checkSpacingForProperty,
            PropertyDefinition: checkSpacingForProperty,
            AccessorProperty: checkSpacingForProperty,
            StaticBlock: checkSpacingAroundFirstToken,
            Property: checkSpacingForProperty,
            BinaryExpression(node) {
                if (node.operator !== ">") return;
                const operatorToken = sourceCode.getTokenBefore(node.right, import_ast_utils.isNotOpeningParenToken);
                tokensToIgnore.add(operatorToken);
            },
            TSAsExpression(node) {
                checkSpacingAround(sourceCode.getTokenAfter(node.expression, (token) => token.value === "as"));
            },
            TSSatisfiesExpression(node) {
                checkSpacingAround(sourceCode.getTokenAfter(node.expression, (token) => token.value === "satisfies"));
            }
        };
    },
};
