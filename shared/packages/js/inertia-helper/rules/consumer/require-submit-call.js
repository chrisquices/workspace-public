import { unwrapExpression, propertyName, formDefinition, functionValue } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'End handleSubmit with a direct call to the form submit method.' },
    schema: [],
    messages: { call: 'End handleSubmit() with this.submit(...); after the processing guard, validation, and preparation. Do not put the call in a branch or callback.' },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        const definition = formDefinition(sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;
        const member = definition.properties.filter((property) => property.type === 'Property'
          && propertyName(property) === 'handleSubmit').at(-1);
        const fn = functionValue(sourceCode, member?.value);
        if (!fn || member.kind !== 'init' || fn.type === 'ArrowFunctionExpression' || fn.body.type !== 'BlockStatement') return;

        const last = fn.body.body.at(-1);
        const call = last?.type === 'ExpressionStatement' ? last.expression : undefined;
        const callee = call?.type === 'CallExpression' ? call.callee : undefined;
        if (!call || call.optional || callee?.type !== 'MemberExpression' || callee.computed || callee.optional
          || unwrapExpression(callee.object)?.type !== 'ThisExpression' || callee.property.name !== 'submit') {
          context.report({ node: member, messageId: 'call' });
        }
      },
    };
  },
};
