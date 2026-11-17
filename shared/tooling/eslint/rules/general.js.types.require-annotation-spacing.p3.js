const { $: warnDeprecation, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
function createRules(options) {
    const globals = {
        ...options?.before !== void 0 ? { before: options.before } : {},
        ...options?.after !== void 0 ? { after: options.after } : {}
    };
    const override = options?.overrides ?? {};
    const colon = {
        before: false,
        after: true,
        ...globals,
        ...override?.colon
    };
    const arrow = typeof override.arrow === "string" ? override.arrow : {
        before: true,
        after: true,
        ...globals,
        ...override?.arrow
    };
    if (Object.hasOwn(override, "arrow") && override.arrow !== "ignore") warnDeprecation("options(\"overrides.arrow\")", "\"arrow-spacing\"", "type-annotation-spacing");
    return {
        colon,
        arrow,
        variable: {
            ...colon,
            ...override?.variable
        },
        property: {
            ...colon,
            ...override?.property
        },
        parameter: {
            ...colon,
            ...override?.parameter
        },
        returnType: {
            ...colon,
            ...override?.returnType
        }
    };
}
function getIdentifierRules(rules, node) {
    const scope = node?.parent;
    if ((0, import_ast_utils.isVariableDeclarator)(scope)) return rules.variable;
    else if ((0, import_ast_utils.isFunctionOrFunctionType)(scope)) return rules.parameter;
    return rules.colon;
}
function getRules(rules, node) {
    const scope = node?.parent?.parent;
    if ((0, import_ast_utils.isTSFunctionType)(scope) || (0, import_ast_utils.isTSConstructorType)(scope)) return rules.arrow;
    else if ((0, import_ast_utils.isIdentifier)(scope)) return getIdentifierRules(rules, scope);
    else if ((0, import_ast_utils.isClassOrTypeElement)(scope)) return rules.property;
    else if ((0, import_ast_utils.isFunction)(scope)) return rules.returnType;
    return rules.colon;
}

export default {
    meta: {
        type: "layout",
        description: "Require type annotation spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedSpaceAfter": "Expected a space after the '{{type}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedSpaceBefore": "Expected a space before the '{{type}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceAfter": "Unexpected space after the '{{type}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceBefore": "Unexpected space before the '{{type}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceBetween": "Unexpected space between the '{{previousToken}}' and the '{{type}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"overrides":{"arrow":"ignore"}}];
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

        const punctuators = [":", "=>"];
        const sourceCode = context.sourceCode;
        const ruleSet = createRules(options);
        function checkTypeAnnotationSpacing(typeAnnotation) {
            const punctuatorTokenEnd = sourceCode.getTokenBefore(typeAnnotation, import_ast_utils.isNotOpeningParenToken);
            let punctuatorTokenStart = punctuatorTokenEnd;
            let previousToken = sourceCode.getTokenBefore(punctuatorTokenEnd);
            let type = punctuatorTokenEnd.value;
            if (!punctuators.includes(type)) return;
            const config = getRules(ruleSet, typeAnnotation);
            if (config === "ignore") return;
            const { before, after } = config;
            if (type === ":" && previousToken.value === "?") {
                if (sourceCode.isSpaceBetween(previousToken, punctuatorTokenStart)) context.report({
                    node: punctuatorTokenStart,
                    data: {
                        type,
                        previousToken: previousToken.value
                    },
                    fix: safeFix(punctuatorTokenStart, function (fixer) {
                        return fixer.removeRange([previousToken.range[1], punctuatorTokenStart.range[0]]);
                    }),
                    messageId: "unexpectedSpaceBetween"
                });
                type = "?:";
                punctuatorTokenStart = previousToken;
                previousToken = sourceCode.getTokenBefore(previousToken);
                if (previousToken.value === "+" || previousToken.value === "-") {
                    type = `${previousToken.value}?:`;
                    punctuatorTokenStart = previousToken;
                    previousToken = sourceCode.getTokenBefore(previousToken);
                }
            }
            const hasNextSpace = sourceCode.isSpaceBetween(punctuatorTokenEnd, typeAnnotation);
            if (after && !hasNextSpace) context.report({
                node: punctuatorTokenEnd,
                data: { type },
                fix: safeFix(punctuatorTokenEnd, function (fixer) {
                    return fixer.insertTextAfter(punctuatorTokenEnd, " ");
                }),
                messageId: "expectedSpaceAfter"
            });
            else if (!after && hasNextSpace) context.report({
                node: punctuatorTokenEnd,
                data: { type },
                fix: safeFix(punctuatorTokenEnd, function (fixer) {
                    return fixer.removeRange([punctuatorTokenEnd.range[1], typeAnnotation.range[0]]);
                }),
                messageId: "unexpectedSpaceAfter"
            });
            const hasPrevSpace = sourceCode.isSpaceBetween(previousToken, punctuatorTokenStart);
            if (before && !hasPrevSpace) context.report({
                node: punctuatorTokenStart,
                data: { type },
                fix: safeFix(punctuatorTokenStart, function (fixer) {
                    return fixer.insertTextAfter(previousToken, " ");
                }),
                messageId: "expectedSpaceBefore"
            });
            else if (!before && hasPrevSpace) context.report({
                node: punctuatorTokenStart,
                data: { type },
                fix: safeFix(punctuatorTokenStart, function (fixer) {
                    return fixer.removeRange([previousToken.range[1], punctuatorTokenStart.range[0]]);
                }),
                messageId: "unexpectedSpaceBefore"
            });
        }
        return {
            TSMappedType(node) {
                if (node.typeAnnotation) checkTypeAnnotationSpacing(node.typeAnnotation);
            },
            TSTypeAnnotation(node) {
                if (["TSPropertySignature", "PropertyDefinition", "AccessorProperty", "TSAbstractPropertyDefinition", "TSAbstractAccessorProperty"].includes(node.parent?.type)) return;
                checkTypeAnnotationSpacing(node.typeAnnotation);
            }
        };
    },
};
