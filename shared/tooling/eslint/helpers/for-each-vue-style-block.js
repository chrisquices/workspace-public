import { CssSyntaxError, parse } from 'postcss';

export const cssStyleMessages = {
    invalidCss: 'Unable to format this <style> block because its CSS syntax is invalid. {{reason}}. Correct the syntax and rerun ESLint.',
};

// Share language selection, parsing, and source offsets across Vue CSS rules.
// PostCSS removes a leading BOM from its input before assigning node offsets.
export function forEachVueStyleBlock(context, visit) {
    const sourceCode = context.sourceCode;
    const document = sourceCode.parserServices.getDocumentFragment?.();

    if (!document) {
        return;
    }

    for (const style of document.children) {
        if (style.type !== 'VElement' || style.rawName !== 'style' || !style.endTag) {
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

            context.report({
                loc: style.startTag.loc,
                messageId: 'invalidCss',
                data: { reason: error.reason },
            });
            continue;
        }

        visit({ root: root, offset: contentStart + (root.source.input.hasBOM ? 1 : 0) });
    }
}
