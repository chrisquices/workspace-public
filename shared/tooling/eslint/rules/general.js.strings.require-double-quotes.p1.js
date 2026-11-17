const { $: warnDeprecation, J: isSurroundedBy, N: hasOctalOrNonOctalDecimalEscapeSequence, U: isParenthesised, Y: isTopLevelExpressionStatement, m: AST_NODE_TYPES, x: LINEBREAKS } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
function switchQuote(str) {
    const newQuote = this.quote;
    const oldQuote = str[0];
    if (newQuote === oldQuote) return str;
    return newQuote + str.slice(1, -1).replace(/\\(\$\{|\r\n?|\n|.)|["'`]|\$\{|(\r\n?|\n)/gu, (match, escaped, newline) => {
        if (escaped === oldQuote || oldQuote === "`" && escaped === "${") return escaped;
        if (match === newQuote || newQuote === "`" && match === "${") return `\\${match}`;
        if (newline && oldQuote === "`") return "\\n";
        return match;
    }) + newQuote;
}
const QUOTE_SETTINGS = {
    double: {
        quote: "\"",
        alternateQuote: "'",
        description: "doublequote",
        convert: switchQuote
    },
    single: {
        quote: "'",
        alternateQuote: "\"",
        description: "singlequote",
        convert: switchQuote
    },
    backtick: {
        quote: "`",
        alternateQuote: "\"",
        description: "backtick",
        convert: switchQuote
    }
};
const UNESCAPED_LINEBREAK_PATTERN = new RegExp(String.raw`(^|[^\\])(\\\\)*[${Array.from(LINEBREAKS).join("")}]`, "u");
const AVOID_ESCAPE = "avoid-escape";

export default {
    meta: {
        type: "layout",
        description: "Require double quotes in scripts.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "wrongQuotes": "Strings must use {{description}}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["double",{"allowTemplateLiterals":"always","avoidEscape":false,"ignoreStringLiterals":false}];
        const [quoteOption, options] = ruleOptions;
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

        const settings = QUOTE_SETTINGS[quoteOption || "double"];
        const sourceCode = context.sourceCode;
        let avoidEscape = false;
        let ignoreStringLiterals = false;
        let allowTemplateLiteralsAlways = false;
        let allowTemplateLiteralsToAvoidEscape = false;
        if (typeof options === "object") {
            avoidEscape = options.avoidEscape === true;
            ignoreStringLiterals = options.ignoreStringLiterals === true;
            if (typeof options.allowTemplateLiterals === "string") {
                allowTemplateLiteralsAlways = options.allowTemplateLiterals === "always";
                allowTemplateLiteralsToAvoidEscape = allowTemplateLiteralsAlways || options.allowTemplateLiterals === "avoidEscape";
            } else if (typeof options.allowTemplateLiterals === "boolean") {
                warnDeprecation("value(boolean) for \"allowTemplateLiterals\"", "\"always\"/\"never\"", "quotes");
                allowTemplateLiteralsAlways = options.allowTemplateLiterals === true;
                allowTemplateLiteralsToAvoidEscape = options.allowTemplateLiterals === true;
            }
        } else if (options === AVOID_ESCAPE) {
            warnDeprecation(`option("${AVOID_ESCAPE}")`, "\"avoidEscape\"", "quotes");
            avoidEscape = true;
        }
        function isJSXLiteral(node) {
            if (!node.parent) return false;
            return node.parent.type === "JSXAttribute" || node.parent.type === "JSXElement" || node.parent.type === "JSXFragment";
        }
        function isDirective(node) {
            return node.type === "ExpressionStatement" && node.expression.type === "Literal" && typeof node.expression.value === "string" && !isParenthesised(sourceCode, node.expression);
        }
        function isExpressionInOrJustAfterDirectivePrologue(node) {
            if (!node.parent) return false;
            if (!isTopLevelExpressionStatement(node.parent)) return false;
            const block = node.parent.parent;
            if (!block || !("body" in block) || !Array.isArray(block.body)) return false;
            for (let i = 0; i < block.body.length; ++i) {
                const statement = block.body[i];
                if (statement === node.parent) return true;
                if (!isDirective(statement)) break;
            }
            return false;
        }
        function isAllowedAsNonBacktick(node) {
            const parent = node.parent;
            if (!parent) return false;
            switch (parent.type) {
                case AST_NODE_TYPES.ExpressionStatement: return !isParenthesised(sourceCode, node) && isExpressionInOrJustAfterDirectivePrologue(node);
                case AST_NODE_TYPES.Property:
                case AST_NODE_TYPES.MethodDefinition: return parent.key === node && !parent.computed;
                case AST_NODE_TYPES.ImportDeclaration:
                case AST_NODE_TYPES.ExportNamedDeclaration: return parent.source === node;
                case AST_NODE_TYPES.ExportAllDeclaration: return parent.exported === node || parent.source === node;
                case AST_NODE_TYPES.ImportSpecifier: return parent.imported === node;
                case AST_NODE_TYPES.ExportSpecifier: return parent.local === node || parent.exported === node;
                case AST_NODE_TYPES.ImportAttribute: return parent.value === node;
                case AST_NODE_TYPES.TSImportType:
                case AST_NODE_TYPES.TSAbstractMethodDefinition:
                case AST_NODE_TYPES.TSMethodSignature:
                case AST_NODE_TYPES.TSPropertySignature:
                case AST_NODE_TYPES.TSModuleDeclaration:
                case AST_NODE_TYPES.TSExternalModuleReference: return true;
                case AST_NODE_TYPES.TSEnumMember: return node === parent.id;
                case AST_NODE_TYPES.TSAbstractPropertyDefinition:
                case AST_NODE_TYPES.PropertyDefinition:
                case AST_NODE_TYPES.AccessorProperty: return parent.key === node && !parent.computed;
                case AST_NODE_TYPES.TSLiteralType: return parent.parent?.type === AST_NODE_TYPES.TSImportType;
                default: return false;
            }
        }
        function isUsingFeatureOfTemplateLiteral(node) {
            if (node.parent.type === "TaggedTemplateExpression" && node === node.parent.quasi) return true;
            if (node.expressions.length > 0) return true;
            if (node.quasis.length >= 1 && UNESCAPED_LINEBREAK_PATTERN.test(node.quasis[0].value.raw)) return true;
            return false;
        }
        return {
            Literal(node) {
                if (ignoreStringLiterals) return;
                const val = node.value;
                const rawVal = node.raw;
                if (settings && typeof val === "string") {
                    let isValid = quoteOption === "backtick" && isAllowedAsNonBacktick(node) || isJSXLiteral(node) || isSurroundedBy(rawVal, settings.quote);
                    if (!isValid && avoidEscape) isValid = isSurroundedBy(rawVal, settings.alternateQuote) && rawVal.includes(settings.quote);
                    if (!isValid) context.report({
                        node,
                        data: { description: settings.description },
                        fix: safeFix(node, function (fixer) {
                            if (quoteOption === "backtick" && hasOctalOrNonOctalDecimalEscapeSequence(rawVal)) return null;
                            return fixer.replaceText(node, settings.convert(node.raw));
                        }),
                        messageId: "wrongQuotes"
                    });
                }
            },
            TemplateLiteral(node) {
                if (allowTemplateLiteralsAlways || quoteOption === "backtick" || isUsingFeatureOfTemplateLiteral(node)) return;
                if (allowTemplateLiteralsToAvoidEscape && avoidEscape && sourceCode.getText(node).includes(settings.quote)) return;
                context.report({
                    node,
                    data: { description: settings.description },
                    fix: safeFix(node, function (fixer) {
                        if (isTopLevelExpressionStatement(node.parent) && !isParenthesised(sourceCode, node)) return null;
                        return fixer.replaceText(node, settings.convert(sourceCode.getText(node)));
                    }),
                    messageId: "wrongQuotes"
                });
            }
        };
    },
};
