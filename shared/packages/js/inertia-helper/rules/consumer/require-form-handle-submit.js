import { propertyName, formDefinition } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'require handleSubmit in every Inertia Helper form' },
    schema: [],
    messages: { handleSubmit: 'useInertiaHelperForm requires a handleSubmit() method.' },
  },

  create(context) {
    return {
      CallExpression(node) {
        const definition = formDefinition(context.sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;

        const hasHandleSubmit = definition.properties.some((property) =>
          property.type === 'Property' && propertyName(property) === 'handleSubmit');

        if (!hasHandleSubmit) {
          context.report({ node: definition, messageId: 'handleSubmit' });
        }
      },
    };
  },
};
