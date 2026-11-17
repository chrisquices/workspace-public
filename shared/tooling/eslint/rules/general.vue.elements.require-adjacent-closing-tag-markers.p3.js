// Keep the > of a closing tag immediately adjacent to its name, as in </div>.
// Remove spaces and line breaks inside that boundary while preserving the
// complete closing tag's position and its surrounding indentation.

export default {
    meta: {
        type: 'layout',
        description: 'Place closing-tag markers immediately after their names.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            adjacent: 'Write this closing tag as </{{element}}> by removing whitespace immediately before >. Preserve the closing tag\'s position and surrounding indentation.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;

        if (!services.defineTemplateBodyVisitor) {
            return {};
        }

        return services.defineTemplateBodyVisitor({
            VEndTag(node) {
                const text = sourceCode.getText(node);
                const whitespace = text.match(/[\t \r\n\f]+(?=>$)/u);

                if (!whitespace) {
                    return;
                }

                const markerStart = node.range[1] - 1;

                context.report({
                    node: node,
                    messageId: 'adjacent',
                    data: { element: node.parent.rawName },
                    fix(fixer) {
                        return fixer.removeRange([markerStart - whitespace[0].length, markerStart]);
                    },
                });
            },
        });
    },
};
