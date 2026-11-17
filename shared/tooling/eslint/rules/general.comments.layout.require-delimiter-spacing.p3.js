const { L: isHashbangComment, x: LINEBREAKS } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const { t: escapeStringRegexp } = await import(new URL("./vendor.js", import.meta.resolve("@stylistic/eslint-plugin")));
function escape(s) {
    return `(?:${escapeStringRegexp(s)})`;
}
function escapeAndRepeat(s) {
    return `${escape(s)}+`;
}
function parseMarkersOption(markers) {
    if (!markers.includes("*")) return markers.concat("*");
    return markers;
}
function createExceptionsPattern(exceptions) {
    let pattern = "";
    if (exceptions.length === 0) pattern += "\\s";
    else {
        pattern += "(?:\\s|";
        if (exceptions.length === 1) pattern += escapeAndRepeat(exceptions[0]);
        else {
            pattern += "(?:";
            pattern += exceptions.map(escapeAndRepeat).join("|");
            pattern += ")";
        }
        pattern += `(?:$|[${Array.from(LINEBREAKS).join("")}]))`;
    }
    return pattern;
}
function createAlwaysStylePattern(markers, exceptions) {
    let pattern = "^";
    if (markers.length === 1) pattern += escape(markers[0]);
    else {
        pattern += "(?:";
        pattern += markers.map(escape).join("|");
        pattern += ")";
    }
    pattern += "?";
    pattern += createExceptionsPattern(exceptions);
    return new RegExp(pattern, "u");
}
function createNeverStylePattern(markers) {
    const pattern = `^(${markers.map(escape).join("|")})?[ \t]+`;
    return new RegExp(pattern, "u");
}

export default {
    meta: {
        type: "layout",
        description: 'Use spaces inside comment delimiters.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpaceAfterMarker": "Unexpected space or tab after marker ({{refChar}}) in comment." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedExceptionAfter": "Expected exception block, space or tab after '{{refChar}}' in comment." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceBefore": "Unexpected space or tab before '*/' in comment." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceAfter": "Unexpected space or tab after '{{refChar}}' in comment." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedSpaceBefore": "Expected space or tab before '*/' in comment." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedSpaceAfter": "Expected space or tab after '{{refChar}}' in comment." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always",{"block":{"balanced":true,"exceptions":["*"],"markers":["!"]},"line":{"exceptions":["/","#"],"markers":["/"]}}];
        const [style, config = {}] = ruleOptions;
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
        const requireSpace = style !== "never";
        const balanced = config.block && config.block.balanced;
        const styleRules = ["block", "line"].reduce((rule, type) => {
            const nodeType = type;
            const markers = parseMarkersOption(config[nodeType] && config[nodeType]?.markers || config.markers || []);
            const exceptions = config[nodeType] && config[nodeType]?.exceptions || config.exceptions || [];
            rule[nodeType] = {
                beginRegex: requireSpace ? createAlwaysStylePattern(markers, exceptions) : createNeverStylePattern(markers),
                endRegex: balanced && requireSpace ? new RegExp(`${createExceptionsPattern(exceptions)}$`, "u") : new RegExp("[ 	]+$", "u"),
                hasExceptions: exceptions.length > 0,
                captureMarker: new RegExp(`^(${markers.map(escape).join("|")})`, "u"),
                markers: new Set(markers)
            };
            return rule;
        }, {});
        function reportBegin(node, messageId, match, refChar) {
            const commentIdentifier = node.type.toLowerCase() === "block" ? "/*" : "//";
            context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    const start = node.range[0];
                    let end = start + 2;
                    if (requireSpace) {
                        if (match) end += match[0].length;
                        return fixer.insertTextAfterRange([start, end], " ");
                    }
                    if (match) end += match[0].length;
                    return fixer.replaceTextRange([start, end], commentIdentifier + (match && match[1] ? match[1] : ""));
                }),
                data: { refChar },
                messageId: (messageId) === "unexpectedSpaceAfterMarker" ? "unexpectedSpaceAfterMarker" : (messageId) === "expectedExceptionAfter" ? "expectedExceptionAfter" : (messageId) === "unexpectedSpaceBefore" ? "unexpectedSpaceBefore" : (messageId) === "unexpectedSpaceAfter" ? "unexpectedSpaceAfter" : (messageId) === "expectedSpaceBefore" ? "expectedSpaceBefore" : "expectedSpaceAfter"
            });
        }
        function reportEnd(node, messageId, match) {
            context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    if (requireSpace) return fixer.insertTextAfterRange([node.range[0], node.range[1] - 2], " ");
                    const end = node.range[1] - 2;
                    let start = end;
                    if (match) start -= match[0].length;
                    return fixer.replaceTextRange([start, end], "");
                }),
                messageId: (messageId) === "unexpectedSpaceAfterMarker" ? "unexpectedSpaceAfterMarker" : (messageId) === "expectedExceptionAfter" ? "expectedExceptionAfter" : (messageId) === "unexpectedSpaceBefore" ? "unexpectedSpaceBefore" : (messageId) === "unexpectedSpaceAfter" ? "unexpectedSpaceAfter" : (messageId) === "expectedSpaceBefore" ? "expectedSpaceBefore" : "expectedSpaceAfter"
            });
        }
        function checkCommentForSpace(node) {
            const type = node.type.toLowerCase();
            const rule = styleRules[type];
            const commentIdentifier = type === "block" ? "/*" : "//";
            if (node.value.length === 0 || rule.markers.has(node.value)) return;
            if (type === "line" && (node.value.startsWith("/ <reference") || node.value.startsWith("/ <amd"))) return;
            const beginMatch = rule.beginRegex.exec(node.value);
            const endMatch = rule.endRegex.exec(node.value);
            if (requireSpace) {
                if (!beginMatch) {
                    const hasMarker = rule.captureMarker.exec(node.value);
                    const marker = hasMarker ? commentIdentifier + hasMarker[0] : commentIdentifier;
                    if (rule.hasExceptions) reportBegin(node, "expectedExceptionAfter", hasMarker, marker);
                    else reportBegin(node, "expectedSpaceAfter", hasMarker, marker);
                }
                if (balanced && type === "block" && !endMatch) reportEnd(node, "expectedSpaceBefore", null);
            } else {
                if (beginMatch) if (!beginMatch[1]) reportBegin(node, "unexpectedSpaceAfter", beginMatch, commentIdentifier);
                else reportBegin(node, "unexpectedSpaceAfterMarker", beginMatch, beginMatch[1]);
                if (balanced && type === "block" && endMatch) reportEnd(node, "unexpectedSpaceBefore", endMatch);
            }
        }
        return { Program() {
            sourceCode.getAllComments().forEach((comment) => {
                if (!isHashbangComment(comment)) checkCommentForSpace(comment);
            });
        } };
    },
};
