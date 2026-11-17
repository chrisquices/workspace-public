import { unwrapExpression, propertyName, formDefinition, functionValue, factoryName } from '../shared/inertia-helper.js';
import { createScopedBindingResolver, propertyName as memberName } from '../../../../../tooling/eslint/helpers/inertia-request.js';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only call a form submit method as the final statement of its handleSubmit method.' },
    schema: [],
    messages: { direct: 'Call handleSubmit(...) instead. This form\'s submit method may only be called as the final this.submit(...); statement of its own handleSubmit(). Do not pass or extract submit as a callback.' },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const bindings = createScopedBindingResolver(sourceCode);
    const owners = new Map();
    const candidates = [];

    function resolve(expression, seen = new Set()) {
      const node = unwrapExpression(expression);
      if (!node || seen.has(node)) return undefined;
      seen.add(node);

      if (node.type === 'Identifier') {
        const definition = bindings.findVariable(node)?.defs.find((entry) => entry.type === 'Variable');
        if (!definition?.node.init) return undefined;
        if (definition.node.id.type === 'Identifier') return resolve(definition.node.init, seen);
        if (definition.node.id.type === 'ObjectPattern') {
          const property = definition.node.id.properties.find((entry) => entry.type === 'Property'
            && (entry.value.type === 'AssignmentPattern' ? entry.value.left : entry.value).name === node.name);
          return property ? resolveProperty(resolve(definition.node.init, seen), propertyName(property), seen) : undefined;
        }
      }
      if (node.type === 'CallExpression') {
        const name = factoryName(sourceCode, node.callee);
        if (name === 'useInertiaHelperForm') {
          const definition = formDefinition(sourceCode, node);
          return definition?.type === 'ObjectExpression' ? { definition, form: true } : undefined;
        }
      }
      if (node.type === 'ObjectExpression') return { definition: node, form: false };
      if (node.type === 'MemberExpression') return resolveProperty(resolve(node.object, seen), memberName(node), seen);
      if (node.type === 'ThisExpression') {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (owners.has(parent)) return { definition: owners.get(parent).definition, form: true };
          if (['FunctionExpression', 'FunctionDeclaration'].includes(parent.type)) {
            const definition = parent.parent?.type === 'Property' ? parent.parent.parent : undefined;
            return definition?.type === 'ObjectExpression' ? { definition, form: false } : undefined;
          }
          if (['ClassDeclaration', 'ClassExpression'].includes(parent.type)) return undefined;
        }
      }
      return undefined;
    }

    function resolveProperty(receiver, name, seen) {
      if (!receiver || name === undefined) return undefined;
      const property = receiver.definition.properties.filter((entry) => entry.type === 'Property'
        && propertyName(entry) === name).at(-1);
      return property ? resolve(property.value, seen) : undefined;
    }

    function check(node) {
      if (node.type === 'MemberExpression') {
        if (memberName(node) !== 'submit') return;
        const receiver = resolve(node.object);
        if (!receiver?.form) return;
        const call = node.parent;
        const statement = call?.parent;
        const body = statement?.parent;
        const fn = body?.parent;
        const owner = owners.get(fn);
        const allowed = !node.computed && !node.optional && node.object.type === 'ThisExpression'
          && call?.type === 'CallExpression' && call.callee === node && !call.optional
          && statement?.type === 'ExpressionStatement' && body?.type === 'BlockStatement'
          && body === fn.body && body.body.at(-1) === statement
          && owner?.name === 'handleSubmit' && owner.definition === receiver.definition;
        if (!allowed) context.report({ node, messageId: 'direct' });
      } else {
        const receiver = resolve(node.type === 'VariableDeclarator' ? node.init : node.right);
        const pattern = node.type === 'VariableDeclarator' ? node.id : node.left;
        if (!receiver?.form || pattern?.type !== 'ObjectPattern') return;
        for (const property of pattern.properties) {
          if (property.type === 'Property' && propertyName(property) === 'submit') {
            context.report({ node: property, messageId: 'direct' });
          }
        }
      }
    }

    const script = {
      CallExpression(node) {
        const definition = formDefinition(sourceCode, node);
        if (definition?.type !== 'ObjectExpression') return;
        for (const property of definition.properties) {
          if (property.type !== 'Property') continue;
          const fn = functionValue(sourceCode, property.value);
          if (fn) owners.set(fn, { definition, name: propertyName(property) });
        }
      },
      MemberExpression(node) { candidates.push(node); },
      VariableDeclarator(node) { candidates.push(node); },
      AssignmentExpression(node) { candidates.push(node); },
      'Program:exit'() { candidates.forEach(check); },
    };
    return sourceCode.parserServices.defineTemplateBodyVisitor
      ? sourceCode.parserServices.defineTemplateBodyVisitor({ MemberExpression: check, AssignmentExpression: check }, script)
      : script;
  },
};
