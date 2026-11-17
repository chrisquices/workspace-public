export default {
    meta: {
        type: 'layout',
        description: 'Place a blank line before standalone comment groups.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            missing: 'Add a blank line before the first standalone comment in this group. Keep consecutive comments together, including mixed //, /* */, and <!-- --> styles.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        return {
            'Program:exit'() {
                const document = services.getDocumentFragment?.();
                const templateTokens = services.getTemplateBodyTokenStore?.() ?? sourceCode;
                const comments = [
                    ...sourceCode.getAllComments().map((function (comment) { return (({ comment: comment, tokens: sourceCode })); })),
                    ...(document?.comments ?? []).map((function (comment) { return (({ comment: comment, tokens: templateTokens })); })),
                ].sort((function (left, right) { return (left.comment.range[0] - right.comment.range[0]); }));
                let previousComment;

                for (const { comment, tokens } of comments) {
                    if (!['Line', 'Block', 'HTMLComment'].includes(comment.type)) {
                        continue;
                    }

                    const before = tokens.getTokenBefore(comment, { filter: (function (token) { return (token.type !== 'HTMLWhitespace'); }) });
                    const after = tokens.getTokenAfter(comment, { filter: (function (token) { return (token.type !== 'HTMLWhitespace'); }) });

                    if (before?.loc.end.line === comment.loc.start.line || after?.loc.start.line === comment.loc.end.line) {
                        continue;
                    }

                    const line = comment.loc.start.line;
                    const continuesGroup = previousComment
                        && line <= previousComment.loc.end.line + 1
                        && sourceCode.text.slice(previousComment.range[1], comment.range[0]).trim() === '';
                    previousComment = comment;
                    const isRegionMarker = /^(?:\/\/|\/\*+|<!--)\s*#?(?:region|endregion)\b/iu.test(sourceCode.getText(comment));

                    if (isRegionMarker || continuesGroup || (line > 1 && sourceCode.lines[line - 2].trim() === '')) {
                        continue;
                    }

                    context.report({
                        loc: comment.loc,
                        messageId: 'missing',
                        fix(fixer) {
                            const start = sourceCode.getIndexFromLoc({ line: line, column: 0 });

                            return fixer.insertTextBeforeRange([start, start], newline);
                        },
                    });
                }
            },
        };
    },
};
