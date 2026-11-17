// Ban native forms throughout consuming apps. The shared Form component owns
// the underlying HTML form. Preserve submission and layout when replacing uses.
export default {
  meta: {
    type: 'suggestion',
    description: 'Use the shared Form component instead of native form elements in app Vue templates.',
        includeInReadme: true,
    schema: [],
    messages: { forbidden: 'Replace native <form> with the shared <Form> component. Import Form from "workspace-packages/ui/form". Preserve IDs, submit-button associations, attributes, bindings, event handlers, refs, validation, submission behavior, and layout.' },
  },

  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services.defineTemplateBodyVisitor) return {};

    return services.defineTemplateBodyVisitor({
      VElement(node) {
        if (node.rawName !== 'form') return;

        context.report({
          loc: node.startTag.loc,
          messageId: 'forbidden',
        });
      },
    });
  },
};
