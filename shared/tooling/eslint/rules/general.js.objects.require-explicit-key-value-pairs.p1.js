export default {
    meta: {
        type: 'suggestion',
        description: 'Require explicit key/value mappings for shorthand properties in object literals, including Vue script and template expressions.',
        includeInReadme: false,
        fixable: 'code',
        schema: [],
        messages: {
            explicit: 'Expand this shorthand object property to {{mapping}}. Preserve its existing value and comments.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const visitor = {
            ObjectExpression(node) {
                for (const property of node.properties) {
                    if (property.type !== 'Property' || !property.shorthand || property.value.type !== 'Identifier') {
                        continue;
                    }

                    const name = sourceCode.getText(property.key);
                    const key = property.key.name === '__proto__' ? '["__proto__"]' : name;
                    const mapping = `${key}: ${name}`;

                    context.report({
                        node: property,
                        messageId: 'explicit',
                        data: { mapping: mapping },
                        fix(fixer) {
                            return fixer.replaceText(property.key, mapping);
                        },
                    });
                }
            },
        };

        return sourceCode.parserServices.defineTemplateBodyVisitor?.(visitor, visitor) ?? visitor;
    },
};
