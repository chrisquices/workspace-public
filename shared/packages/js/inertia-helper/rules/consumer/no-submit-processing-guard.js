import { unwrapExpression, propertyName, formDefinition, functionValue } from '../shared/inertia-helper.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Keep processing checks in handleSubmit instead of submit.' },
    schema: [],
    messages: { guard: 'Move this.processing checks out of submit(). Start handleSubmit() with if (this.processing) return; instead.' },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        const definition = formDefinition(sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;
        const member = definition.properties.filter((property) => property.type === 'Property'
          && propertyName(property) === 'submit').at(-1);
        const fn = functionValue(sourceCode, member?.value);
        if (!fn || member.kind !== 'init' || fn.body.type !== 'BlockStatement') return;

        const pending = [fn.body];
        while (pending.length) {
          const child = pending.pop();
          if (['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration', 'ClassExpression', 'ClassDeclaration'].includes(child.type)) continue;
          if (child.type === 'MemberExpression' && unwrapExpression(child.object)?.type === 'ThisExpression'
            && (child.computed ? child.property.value : child.property.name) === 'processing') {
            context.report({ node: child, messageId: 'guard' });
          }
          for (const key of sourceCode.visitorKeys[child.type] ?? []) {
            const children = Array.isArray(child[key]) ? child[key] : [child[key]];
            pending.push(...children.filter((entry) => entry?.type));
          }
        }
      },
    };
  },
};
