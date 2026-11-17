import { propertyName, formDefinition } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'require submit in every Inertia Helper form' },
    schema: [],
    messages: { submit: 'useInertiaHelperForm requires a submit() method.' },
  },

  create(context) {
    return {
      CallExpression(node) {
        const definition = formDefinition(context.sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;

        const hasSubmit = definition.properties.some((property) =>
          property.type === 'Property' && propertyName(property) === 'submit');

        if (!hasSubmit) {
          context.report({ node: definition, messageId: 'submit' });
        }
      },
    };
  },
};
