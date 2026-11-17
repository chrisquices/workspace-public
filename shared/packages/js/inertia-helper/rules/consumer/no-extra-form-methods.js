import { propertyName, formDefinition, functionValue } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'restrict custom Inertia Helper form method names' },
    schema: [],
    messages: {
      extra: 'The custom method {{ name }} is not allowed on useInertiaHelperForm. Keep data fields, submit(), and handleSubmit(); place the processing guard, validation, and preparation in handleSubmit() and request logic in submit(). Preserve the behavior when restructuring. Keep broader domain state and additional methods outside the form.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const definition = formDefinition(sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;

        for (const property of definition.properties) {
          if (property.type !== 'Property') continue;

          const name = propertyName(property);
          if (name === undefined || name === 'submit' || name === 'handleSubmit') continue;

          if (functionValue(sourceCode, property.value) || property.method || property.kind !== 'init') {
            context.report({ node: property, messageId: 'extra', data: { name } });
          }
        }
      },
    };
  },
};
