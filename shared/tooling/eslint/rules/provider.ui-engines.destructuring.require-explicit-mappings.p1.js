export default {
    meta: {
        type: 'suggestion',
        description: 'Use explicit property-to-variable mappings in UI engine object destructuring.',
        includeInReadme: false,
        fixable: 'code',
        schema: [],
        messages: {
            explicit: 'Use an explicit property-to-variable mapping: {{name}}: {{name}}.',
        },
    },

    create(context) {
        return {
            ObjectPattern(node) {
                for (const property of node.properties) {
                    if (property.type !== 'Property' || !property.shorthand || property.key.type !== 'Identifier') continue;

                    context.report({
                        node: property,
                        messageId: 'explicit',
                        data: {name: property.key.name},
                        fix(fixer) {
                            const name = context.sourceCode.getText(property.key);
                            return fixer.insertTextAfter(property.key, `: ${name}`);
                        },
                    });
                }
            },
        };
    },
};
