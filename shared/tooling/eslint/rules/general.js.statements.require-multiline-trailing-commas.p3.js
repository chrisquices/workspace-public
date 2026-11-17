// Run with final layout so newly expanded literals get trailing commas in the
// same autofix pass. The rule's public ID and comma policy remain unchanged.
const { O: getNextLocation, g: import_ast_utils, m: AST_NODE_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const OPTION_VALUE_SCHEME = [
    "always-multiline",
    "always",
    "never",
    "only-multiline"
];

export default {
    meta: {
        type: "layout",
        description: "Require multiline trailing commas.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "unexpected": "Unexpected trailing comma." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missing": "Missing trailing comma." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always-multiline"];
        const [options] = ruleOptions;
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

        function normalizeOptions(options = {}, ecmaVersion) {
            const DEFAULT_OPTION_VALUE = "never";
            if (typeof options === "string") return {
                arrays: options,
                objects: options,
                imports: options,
                exports: options,
                functions: !ecmaVersion || ecmaVersion === "latest" ? options : ecmaVersion < 2017 ? "ignore" : options,
                importAttributes: options,
                dynamicImports: !ecmaVersion || ecmaVersion === "latest" ? options : ecmaVersion < 2025 ? "ignore" : options,
                enums: options,
                generics: options,
                tuples: options
            };
            return {
                arrays: options.arrays ?? DEFAULT_OPTION_VALUE,
                objects: options.objects ?? DEFAULT_OPTION_VALUE,
                imports: options.imports ?? DEFAULT_OPTION_VALUE,
                exports: options.exports ?? DEFAULT_OPTION_VALUE,
                functions: options.functions ?? DEFAULT_OPTION_VALUE,
                importAttributes: options.importAttributes ?? DEFAULT_OPTION_VALUE,
                dynamicImports: options.dynamicImports ?? DEFAULT_OPTION_VALUE,
                enums: options.enums ?? DEFAULT_OPTION_VALUE,
                generics: options.generics ?? DEFAULT_OPTION_VALUE,
                tuples: options.tuples ?? DEFAULT_OPTION_VALUE
            };
        }
        const normalizedOptions = normalizeOptions(options, context.languageOptions?.ecmaVersion ?? context.parserOptions?.ecmaVersion);
        const isTSX = (context.languageOptions?.parserOptions?.ecmaFeatures?.jsx ?? context.parserOptions?.ecmaFeatures?.jsx) && context.filename?.endsWith(".tsx");
        const sourceCode = context.sourceCode;
        const closeBraces = [
            "}",
            "]",
            ")",
            ">"
        ];
        const predicate = {
            "always": forceTrailingComma,
            "always-multiline": forceTrailingCommaIfMultiline,
            "only-multiline": allowTrailingCommaIfMultiline,
            "never": forbidTrailingComma,
            "ignore": () => {}
        };
        function last(nodes) {
            if (!nodes) return null;
            return nodes[nodes.length - 1] ?? null;
        }
        function getTrailingToken(info) {
            switch (info.node.type) {
                case "ObjectExpression":
                case "ArrayExpression":
                case "CallExpression":
                case "NewExpression":
                case "ImportExpression": return sourceCode.getLastToken(info.node, 1);
                default: {
                    const lastItem = info.lastItem;
                    if (!lastItem) return null;
                    const nextToken = sourceCode.getTokenAfter(lastItem);
                    if ((0, import_ast_utils.isCommaToken)(nextToken)) return nextToken;
                    return sourceCode.getLastToken(lastItem);
                }
            }
        }
        function isMultiline(info) {
            if (!info.lastItem) return false;
            const penultimateToken = getTrailingToken(info);
            if (!penultimateToken) return false;
            const lastToken = sourceCode.getTokenAfter(penultimateToken);
            if (!lastToken) return false;
            return lastToken.loc.end.line !== penultimateToken.loc.end.line;
        }
        function isTrailingCommaAllowed(lastItem) {
            return lastItem.type !== "RestElement";
        }
        function forbidTrailingComma(info) {
            if (isTSX && info.node.type === AST_NODE_TYPES.TSTypeParameterDeclaration && info.node.params.length === 1) return;
            const lastItem = info.lastItem;
            if (!lastItem) return;
            const trailingToken = getTrailingToken(info);
            if (trailingToken && (0, import_ast_utils.isCommaToken)(trailingToken)) context.report({
                node: lastItem,
                loc: trailingToken.loc,
                fix: safeFix(lastItem, function* (fixer) {
                    yield fixer.remove(trailingToken);
                    yield fixer.insertTextBefore(sourceCode.getTokenBefore(trailingToken), "");
                    yield fixer.insertTextAfter(sourceCode.getTokenAfter(trailingToken), "");
                }),
                messageId: "unexpected"
            });
        }
        function forceTrailingComma(info) {
            const lastItem = info.lastItem;
            if (!lastItem) return;
            if (!isTrailingCommaAllowed(lastItem)) {
                forbidTrailingComma(info);
                return;
            }
            const trailingToken = getTrailingToken(info);
            if (!trailingToken || trailingToken.value === ",") return;
            const nextToken = sourceCode.getTokenAfter(trailingToken);
            if (!nextToken || !closeBraces.includes(nextToken.value)) return;
            context.report({
                node: lastItem,
                loc: {
                    start: trailingToken.loc.end,
                    end: getNextLocation(sourceCode, trailingToken.loc.end)
                },
                fix: safeFix(lastItem, function* (fixer) {
                    yield fixer.insertTextAfter(trailingToken, ",");
                    yield fixer.insertTextBefore(trailingToken, "");
                    yield fixer.insertTextAfter(sourceCode.getTokenAfter(trailingToken), "");
                }),
                messageId: "missing"
            });
        }
        function allowTrailingCommaIfMultiline(info) {
            if (!isMultiline(info)) forbidTrailingComma(info);
        }
        function forceTrailingCommaIfMultiline(info) {
            if (isMultiline(info)) forceTrailingComma(info);
            else forbidTrailingComma(info);
        }
        return {
            ObjectExpression: (node) => {
                predicate[normalizedOptions.objects]({
                    node,
                    lastItem: last(node.properties)
                });
            },
            ObjectPattern: (node) => {
                predicate[normalizedOptions.objects]({
                    node,
                    lastItem: last(node.properties)
                });
            },
            ArrayExpression: (node) => {
                predicate[normalizedOptions.arrays]({
                    node,
                    lastItem: last(node.elements)
                });
            },
            ArrayPattern: (node) => {
                predicate[normalizedOptions.arrays]({
                    node,
                    lastItem: last(node.elements)
                });
            },
            ImportDeclaration: (node) => {
                const lastSpecifier = last(node.specifiers);
                if (lastSpecifier?.type === "ImportSpecifier") predicate[normalizedOptions.imports]({
                    node,
                    lastItem: lastSpecifier
                });
                predicate[normalizedOptions.importAttributes]({
                    node,
                    lastItem: last(node.attributes)
                });
            },
            ExportNamedDeclaration: (node) => {
                predicate[normalizedOptions.exports]({
                    node,
                    lastItem: last(node.specifiers)
                });
                predicate[normalizedOptions.importAttributes]({
                    node,
                    lastItem: last(node.attributes)
                });
            },
            ExportAllDeclaration: (node) => {
                predicate[normalizedOptions.importAttributes]({
                    node,
                    lastItem: last(node.attributes)
                });
            },
            FunctionDeclaration: (node) => {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.params)
                });
            },
            FunctionExpression: (node) => {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.params)
                });
            },
            ArrowFunctionExpression: (node) => {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.params)
                });
            },
            CallExpression: (node) => {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.arguments)
                });
            },
            NewExpression: (node) => {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.arguments)
                });
            },
            ImportExpression: (node) => {
                predicate[normalizedOptions.dynamicImports]({
                    node,
                    lastItem: node.options ?? node.source
                });
            },
            TSEnumDeclaration(node) {
                predicate[normalizedOptions.enums]({
                    node,
                    lastItem: last(node.body?.members ?? node.members)
                });
            },
            TSTypeParameterDeclaration(node) {
                predicate[normalizedOptions.generics]({
                    node,
                    lastItem: last(node.params)
                });
            },
            TSTypeParameterInstantiation(node) {
                predicate.never({
                    node,
                    lastItem: last(node.params)
                });
            },
            TSTupleType(node) {
                predicate[normalizedOptions.tuples]({
                    node,
                    lastItem: last(node.elementTypes)
                });
            },
            TSDeclareFunction(node) {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.params)
                });
            },
            TSFunctionType(node) {
                predicate[normalizedOptions.functions]({
                    node,
                    lastItem: last(node.params)
                });
            }
        };
    },
};
