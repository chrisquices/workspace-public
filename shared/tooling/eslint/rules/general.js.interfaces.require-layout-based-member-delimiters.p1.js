const { K: isSingleLine, m: AST_NODE_TYPES, p: deepMerge } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
function isLastTokenEndOfLine(token, line) {
    return token.loc.start.column === line.length - 1;
}
function isCommentsEndOfLine(token, comments, line) {
    if (!comments) return false;
    if (comments.loc.end.line > token.loc.end.line) return true;
    return comments.loc.end.column === line.length;
}
function makeFixFunction({ optsNone, optsSemi, lastToken, commentsAfterLastToken, missingDelimiter, lastTokenLine, isSingleLine, splitMembersFix }) {
    if (optsNone && !isLastTokenEndOfLine(lastToken, lastTokenLine) && !isCommentsEndOfLine(lastToken, commentsAfterLastToken, lastTokenLine) && !isSingleLine) return splitMembersFix;
    return (fixer) => {
        if (optsNone) return fixer.remove(lastToken);
        const token = optsSemi ? ";" : ",";
        if (missingDelimiter) return fixer.insertTextAfter(lastToken, token);
        return fixer.replaceText(lastToken, token);
    };
}
const BASE_SCHEMA = {
    type: "object",
    properties: {
        multiline: {
            type: "object",
            properties: {
                delimiter: { $ref: "#/items/0/$defs/multiLineOption" },
                requireLast: { type: "boolean" }
            },
            additionalProperties: false
        },
        singleline: {
            type: "object",
            properties: {
                delimiter: { $ref: "#/items/0/$defs/singleLineOption" },
                requireLast: { type: "boolean" }
            },
            additionalProperties: false
        }
    },
    additionalProperties: false
};

export default {
    meta: {
        type: "layout",
        description: 'Use commas between single-line interface and type members; put multiline members on separate lines without delimiters.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "unexpectedComma": "Use commas between single-line members. Put multiline members on separate lines without delimiters. Preserve comments and types.",
            "unexpectedSemi": "Use commas between single-line members. Put multiline members on separate lines without delimiters. Preserve comments and types.",
            "expectedComma": "Use commas between single-line members. Put multiline members on separate lines without delimiters. Preserve comments and types.",
            "expectedSemi": "Use commas between single-line members. Put multiline members on separate lines without delimiters. Preserve comments and types."
        },
    },
    create(context) {
        const ruleOptions = [{"multiline":{"delimiter":"none","requireLast":false},"singleline":{"delimiter":"comma","requireLast":false},"multilineDetection":"brackets","overrides":{"interface":{"multiline":{"delimiter":"none","requireLast":false}}}}];
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

        const sourceCode = context.sourceCode;
        const baseOptions = options;
        const overrides = baseOptions.overrides ?? {};
        const interfaceOptions = deepMerge(baseOptions, overrides.interface);
        const typeLiteralOptions = deepMerge(baseOptions, overrides.typeLiteral);
        function splitMemberFix(member, lastToken, body, nextMember) {
            const nextToken = nextMember ? sourceCode.getFirstToken(nextMember) : sourceCode.getLastToken(body);
            if (!nextToken) return;
            const gap = sourceCode.text.slice(lastToken.range[1], nextToken.range[0]);
            // Do not move comments or alter their attachment to a member.
            if (!/^[\t \r\n\u2028\u2029]*$/u.test(gap)) return;
            if (/[\r\n\u2028\u2029]/u.test(gap)) return (fixer) => fixer.remove(lastToken);

            const lines = sourceCode.getLines();
            const bodyIndent = lines[body.loc.start.line - 1].match(/^[\t ]*/u)[0];
            const memberPrefix = lines[member.loc.start.line - 1].slice(0, member.loc.start.column);
            const memberIndent = /^[\t ]*$/u.test(memberPrefix) ? memberPrefix : `${bodyIndent}    `;
            const indent = nextMember ? memberIndent : bodyIndent;
            const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? "\n";
            return (fixer) => fixer.replaceTextRange([lastToken.range[0], nextToken.range[0]], newline + indent);
        }
        function checkLastToken(member, opts, isLast, body, nextMember) {
            function getOption(type) {
                if (isLast && !opts.requireLast) return type === "none";
                return opts.delimiter === type;
            }
            let messageId = null;
            let missingDelimiter = false;
            const lastToken = sourceCode.getLastToken(member, { includeComments: false });
            if (!lastToken) return;
            const commentsAfterLastToken = sourceCode.getCommentsAfter(lastToken).pop();
            const lastTokenLine = sourceCode.getLines()[lastToken?.loc.start.line - 1];
            const optsSemi = getOption("semi");
            const optsComma = getOption("comma");
            const optsNone = getOption("none");
            if (lastToken.value === ";") {
                if (optsComma) messageId = "expectedComma";
                else if (optsNone) {
                    missingDelimiter = true;
                    messageId = "unexpectedSemi";
                }
            } else if (lastToken.value === ",") {
                if (optsSemi) messageId = "expectedSemi";
                else if (optsNone) {
                    missingDelimiter = true;
                    messageId = "unexpectedComma";
                }
            } else if (optsSemi) {
                missingDelimiter = true;
                messageId = "expectedSemi";
            } else if (optsComma) {
                missingDelimiter = true;
                messageId = "expectedComma";
            }
            if (messageId) context.report({
                node: lastToken,
                loc: {
                    start: {
                        line: lastToken.loc.end.line,
                        column: lastToken.loc.end.column
                    },
                    end: {
                        line: lastToken.loc.end.line,
                        column: lastToken.loc.end.column
                    }
                },
                fix: safeFix(lastToken, makeFixFunction({
                    optsNone,
                    optsSemi,
                    lastToken,
                    commentsAfterLastToken,
                    missingDelimiter,
                    lastTokenLine,
                    isSingleLine: opts.type === "single-line",
                    splitMembersFix: optsNone && opts.type === "multi-line"
                        ? splitMemberFix(member, lastToken, body, nextMember)
                        : undefined
                })),
                messageId: (messageId) === "unexpectedComma" ? "unexpectedComma" : (messageId) === "unexpectedSemi" ? "unexpectedSemi" : (messageId) === "expectedComma" ? "expectedComma" : "expectedSemi"
            });
        }
        function checkMemberSeparatorStyle(node) {
            const members = node.type === AST_NODE_TYPES.TSInterfaceBody ? node.body : node.members;
            let _isSingleLine = isSingleLine(node);
            if (options.multilineDetection === "last-member" && !_isSingleLine && members.length > 0) {
                if (members[members.length - 1].loc.end.line === node.loc.end.line) _isSingleLine = true;
            }
            const typeOpts = node.type === AST_NODE_TYPES.TSInterfaceBody ? interfaceOptions : typeLiteralOptions;
            const opts = _isSingleLine ? {
                ...typeOpts.singleline,
                type: "single-line"
            } : {
                ...typeOpts.multiline,
                type: "multi-line"
            };
            members.forEach((member, index) => {
                checkLastToken(member, opts ?? {}, index === members.length - 1, node, members[index + 1]);
            });
        }
        return {
            TSInterfaceBody: checkMemberSeparatorStyle,
            TSTypeLiteral: checkMemberSeparatorStyle
        };
    },
};
