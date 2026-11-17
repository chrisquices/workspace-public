// Ban native inputs in consuming app templates. Shared Input implementation
// internals remain outside consumer scope. Replacement is manual so bindings,
// refs, events, and form behavior can be preserved.
export default {
    meta: {
        type: 'suggestion',
        description: 'Use the shared Input component instead of native input elements in app Vue templates.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Replace native <input> with the shared <Input> component. Import Input from "workspace-packages/ui/input" if needed. Preserve its type, attributes, value bindings, event handlers, refs, and form behavior.',
        },
    },

    create(context) {
        const services = context.sourceCode.parserServices;

        if (!services.defineTemplateBodyVisitor) return {};

        return services.defineTemplateBodyVisitor({
            VElement(node) {
                if (node.rawName !== 'input') return;

                context.report({
                    loc: node.startTag.loc,
                    messageId: 'forbidden',
                });
            },
        });
    },
};
