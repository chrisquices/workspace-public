import { CssSyntaxError, parse } from 'postcss';

export const codeRegionMessages = {
    invalidCss: 'Unable to check code regions in this <style> block because its CSS is invalid. {{reason}}. Fix the CSS syntax and rerun the quality command.',
};

function readRegion(sourceCode, comment) {
    const raw = sourceCode.text.slice(...comment.range);
    let opening;
    let closing = '';

    if (comment.type === 'HTMLComment') {
        opening = '<!--';
        closing = '-->';
    } else if (comment.type === 'Block') {
        opening = raw.match(/^\/\*+/u)[0];
        closing = '*/';
    } else if (comment.type === 'Line') {
        opening = '//';
    } else {
        return null;
    }

    const body = raw.slice(opening.length, raw.length - closing.length).trim();
    const marker = /^#?(region|endregion)\b/iu.exec(body);

    if (!marker) {
        return null;
    }

    const line = sourceCode.lines[comment.loc.start.line - 1];
    const ending = closing ? ` ${closing}` : '';

    return {
        comment: comment,
        raw: raw,
        opening: opening,
        ending: ending,
        line: line,
        isOpening: marker[1].toLowerCase() === 'region',
        standalone: comment.loc.start.line === comment.loc.end.line
            && line.slice(0, comment.loc.start.column).trim() === ''
            && line.slice(comment.loc.end.column).trim() === '',
        canonicalText: `${opening} ${body}${ending}`,
        banner: /^region --- (\S(?:.*\S)?) (-+)$/u.exec(body),
    };
}

export function createCodeRegionVisitor(context, check) {
    const sourceCode = context.sourceCode;
    const services = sourceCode.parserServices;
    const document = services.getDocumentFragment?.();

    function checkComments(comments) {
        const regions = comments.toSorted(function (left, right) {
            return left.range[0] - right.range[0];
        }).map(function (comment) {
            return readRegion(sourceCode, comment);
        }).filter(Boolean);

        check(regions);
    }

    const visitor = {
        Program() {
            const comments = sourceCode.getAllComments();

            if (!document) {
                checkComments(comments);
                return;
            }

            const elements = document.children.filter(function (node) { return node.type === 'VElement'; });
            const scripts = elements.filter(function (node) { return node.rawName === 'script'; });
            const templates = elements.filter(function (node) { return node.rawName === 'template'; });
            const markupComments = document.comments.filter(function (comment) { return comment.type === 'HTMLComment'; });

            for (const script of scripts) {
                checkComments(comments.filter(function (comment) {
                    return comment.range[0] >= script.startTag.range[1]
                        && comment.range[1] <= (script.endTag?.range[0] ?? script.range[1]);
                }));
            }

            for (const template of templates) {
                checkComments(markupComments.filter(function (comment) {
                    return comment.range[0] >= template.range[0] && comment.range[1] <= template.range[1];
                }));
            }

            checkComments(markupComments.filter(function (comment) {
                return !templates.some(function (template) {
                    return comment.range[0] >= template.range[0] && comment.range[1] <= template.range[1];
                });
            }));

            for (const style of elements) {
                if (style.rawName !== 'style' || !style.endTag) {
                    continue;
                }

                const language = style.startTag.attributes.find(function (attribute) {
                    return !attribute.directive && attribute.key.name === 'lang';
                })?.value?.value;

                if (language && language !== 'css' && language !== 'postcss') {
                    continue;
                }

                const contentStart = style.startTag.range[1];
                const content = sourceCode.text.slice(contentStart, style.endTag.range[0]);
                let root;

                try {
                    root = parse(content, { from: context.filename });
                } catch (error) {
                    if (!(error instanceof CssSyntaxError)) {
                        throw error;
                    }

                    context.report({ loc: style.startTag.loc, messageId: 'invalidCss', data: { reason: error.reason } });
                    continue;
                }

                const offset = contentStart + (root.source.input.hasBOM ? 1 : 0);
                const styleComments = [];

                root.walkComments(function (node) {
                    const start = offset + node.source.start.offset;
                    const end = offset + node.source.end.offset;

                    styleComments.push({
                        type: 'Block',
                        range: [start, end],
                        loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
                    });
                });

                checkComments(styleComments);
            }
        },
    };

    if (document && services.defineTemplateBodyVisitor) {
        return services.defineTemplateBodyVisitor({
            VExpressionContainer(node) {
                checkComments(document.comments.filter(function (comment) {
                    return comment.type !== 'HTMLComment'
                        && comment.range[0] >= node.range[0] && comment.range[1] <= node.range[1];
                }));
            },
        }, visitor);
    }

    return visitor;
}
