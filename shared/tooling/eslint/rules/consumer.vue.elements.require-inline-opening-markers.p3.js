// Keep an opening tag's > or /> on the same line as its final attribute or tag
// name. Preserve the attribute layout and attribute values when joining the marker.
// Use one separating space before /> when joining a self-closing marker.

export default {
    meta: {
        type: 'layout',
        description: 'Place opening tag markers on the final attribute or tag-name line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            inline: 'Move {{marker}} onto the final attribute or tag-name line of <{{element}}>. Preserve attribute values and their existing layout. Separate /> from the preceding attribute or tag name with one space when joining it.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;

        if (!services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) {
            return {};
        }

        const tokens = services.getTemplateBodyTokenStore();

        return services.defineTemplateBodyVisitor({
            VStartTag(node) {
                const closing = tokens.getLastToken(node);

                if (!closing) {
                    return;
                }

                const marker = sourceCode.getText(closing);

                if (!['>', '/>'].includes(marker)) {
                    return;
                }

                const previousEnd = node.attributes.at(-1)?.range[1] ?? node.range[0] + node.parent.rawName.length + 1;
                const gap = sourceCode.text.slice(previousEnd, closing.range[0]);

                if (!/^[\t \r\n\f]*$/u.test(gap) || !/[\r\n]/u.test(gap)) {
                    return;
                }

                context.report({
                    node: closing,
                    messageId: 'inline',
                    data: { marker: marker, element: node.parent.rawName },
                    fix(fixer) {
                        return fixer.replaceTextRange([previousEnd, closing.range[0]], node.selfClosing ? ' ' : '');
                    },
                });
            },
        });
    },
};
