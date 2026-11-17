import { formDefinition, propertyName } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'layout',
    docs: { description: 'Declare handleSubmit before submit in Inertia Helper form definitions.' },
    schema: [],
    messages: {
      order: 'Declare handleSubmit() above submit() in this useInertiaHelperForm definition. Move the entire handler with its comments while preserving its behavior.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const definition = formDefinition(context.sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;
        const submit = definition.properties.find((property) => property.type === 'Property'
          && propertyName(property) === 'submit');
        if (!submit) return;

        for (const property of definition.properties) {
          if (property.type === 'Property' && propertyName(property) === 'handleSubmit'
            && property.range[0] > submit.range[0]) {
            context.report({ node: property, messageId: 'order' });
          }
        }
      },
    };
  },
};
