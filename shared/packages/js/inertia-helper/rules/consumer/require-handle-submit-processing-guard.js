import { unwrapExpression, propertyName, formDefinition, functionValue } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'require a processing guard at the start of form handleSubmit methods' },
    schema: [],
    messages: { guard: 'Start handleSubmit() with if (this.processing) return; before any other work.' },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const definition = formDefinition(sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;

        const handleSubmit = definition.properties
          .filter((property) => property.type === 'Property' && propertyName(property) === 'handleSubmit')
          .at(-1);
        const fn = functionValue(sourceCode, handleSubmit?.value);

        // Missing/invalid methods are handled by their own rules.
        if (!fn || handleSubmit?.kind !== 'init' || fn.type === 'ArrowFunctionExpression'
          || fn.body?.type !== 'BlockStatement') return;

        const first = fn.body.body[0];
        const condition = unwrapExpression(first?.test);
        const exit = first?.consequent;

        const hasGuard = first?.type === 'IfStatement'
          && first.loc.start.line === first.loc.end.line
          && !first.alternate
          && condition?.type === 'MemberExpression'
          && !condition.computed
          && !condition.optional
          && unwrapExpression(condition.object)?.type === 'ThisExpression'
          && condition.property.name === 'processing'
          && exit?.type === 'ReturnStatement'
          && exit.argument === null;

        if (!hasGuard) {
          context.report({ node: handleSubmit, messageId: 'guard' });
        }
      },
    };
  },
};
