import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import { unwrapExpression as unwrapScriptExpression } from '#eslint/helpers/unwrap-expression.js';

const isElement = (function (node, names) { return (node?.type === 'VElement' && names.includes(node.rawName)); });

const isField = (function (node) { return (isElement(node, ['Field', 'field'])); });

const isFieldLabel = (function (node) { return (isElement(node, ['FieldLabel', 'field-label'])); });

const isFieldContent = (function (node) { return (isElement(node, ['FieldContent', 'field-content'])); });

const isInput = (function (node) { return (isElement(node, ['Input', 'input'])); });

const isHiddenInput = (function (node, attributeValue) { return (isInput(node)
  && attributeValue(node, 'type')?.key.toLowerCase() === 'literal:hidden'); });

const getElementAttributes = (function (node, name, { directive, caseInsensitive = false } = {}) {
  const normalize = (function (value) { return (caseInsensitive ? value.toLowerCase() : value); });
  const names = [name].flat().map(normalize);

  return node.startTag.attributes.filter((function (attribute) {
    if (!attribute.directive) {
      return !directive && names.includes(normalize(attribute.key.name));
    }

    return attribute.key.name.name === (directive ?? 'bind')
      && attribute.key.argument?.type === 'VIdentifier'
      && names.includes(normalize(attribute.key.argument.name));
  }));
});

// Equal-looking loop/slot variables from different template scopes are not the
// same binding. Global/script identifiers are already identified by their names.
const sameElementAttributeValue = (function (left, right) {
  if (!left || !right || left.key !== right.key) {
      return false;
  }

  const locals = (function (value) { return (new Map((value.attribute.value?.references ?? [])
    .filter((function (reference) { return (reference.variable); }))
    .map((function (reference) { return ([reference.id.name, reference.variable]); })))); });
  const leftLocals = locals(left);
  const rightLocals = locals(right);
  return leftLocals.size === rightLocals.size
    && [...leftLocals].every((function ([name, variable]) { return (rightLocals.get(name) === variable); }));
});

const getElementAttributeValue = (function (sourceCode) {

  // Compare expression structure, not raw token spelling. Quote style,
  // parentheses, formatting, and TypeScript casts do not change an ID.
  const expressionShape = (function (expression) {
    const node = unwrapScriptExpression(expression);
    if (!node) return null;

    if (node.type === 'Identifier') {
        return ['Identifier', node.name];
    }

    if (node.type === 'Literal') {
      if (node.regex) {
          return ['RegExpLiteral', node.regex.pattern, node.regex.flags];
      }

      if (node.bigint !== undefined) {
          return ['BigIntLiteral', node.bigint];
      }

      return ['Literal', node.value];
    }

    if (node.type === 'TemplateElement') {
        return ['TemplateElement', node.value.cooked ?? node.value.raw];
    }

    if (node.type === 'TemplateLiteral' && !node.expressions.length) {
      return ['Literal', node.quasis[0].value.cooked ?? node.quasis[0].value.raw];
    }

    const flags = ['operator', 'computed', 'optional', 'kind', 'method', 'shorthand', 'async', 'generator', 'delegate', 'prefix']
      .filter((function (key) { return (node[key] !== undefined); }))
      .map((function (key) { return ([key, node[key]]); }));
    const children = (sourceCode.visitorKeys[node.type] ?? [])
      .filter((function (key) { return (!['typeArguments', 'typeParameters', 'typeAnnotation', 'returnType'].includes(key)); }))
      .map((function (key) { return ([key, Array.isArray(node[key]) ? node[key].map(expressionShape) : expressionShape(node[key])]); }));
    return [node.type, flags, children];
  });

  const expressionKey = (function (expression) { return (`expression:${JSON.stringify(expressionShape(expression))}`); });

  return (function (node, name) {
    const attribute = getElementAttributes(node, name)[0];
    if (!attribute) return undefined;

    const literal = (function (value) { return (String(value).trim()
      ? { attribute: attribute, key: `literal:${value}` }
      : undefined); });

    if (!attribute.directive) {
        return attribute.value ? literal(attribute.value.value) : undefined;
    }

    if (!attribute.value) {
      return { attribute: attribute, key: expressionKey({ type: 'Identifier', name: name }) };
    }

    const expression = unwrapScriptExpression(attribute.value.expression);
    if (!expression) return undefined;

    if (expression.type === 'Literal') {
      if (['string', 'number'].includes(typeof expression.value)) {
          return literal(expression.value);
      }

      if (expression.value == null) return undefined;
    }

    if (expression.type === 'TemplateLiteral' && !expression.expressions.length) {
      const value = expression.quasis[0].value.cooked;
      return value == null ? undefined : literal(value);
    }

    return { attribute: attribute, key: expressionKey(expression) };
  });
});

// Compare authored values/expressions, never execute bindings or rewrite IDs.
const uiRuleOrChecks = {
  meta: {
    type: 'problem',
    docs: { description: 'match existing FieldLabel for and input id values within the same Field, allowing labels in Field or FieldContent' },
    schema: [],
    messages: {
      mismatch: 'FieldLabel bindings [{{ labels }}] do not match input bindings [{{ inputs }}] in this <Field>. Pair each for/:for with the intended id/:id using the same value or dynamic expression. Preserve existing references to these IDs.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const services = sourceCode.parserServices;
    if (!services.defineTemplateBodyVisitor) return {};

    const attributeValue = getElementAttributeValue(sourceCode);

    return services.defineTemplateBodyVisitor({
      VElement(node) {
        if (!isField(node)) return;

        // Direct relationships exclude nested Fields and malformed structures,
        // whose placement and required attributes have their own rules.
        const contents = node.children.filter(isFieldContent);
        const labels = [
          ...node.children.filter(isFieldLabel),
          ...contents.flatMap((function (content) { return (content.children.filter(isFieldLabel)); })),
        ];
        const inputs = contents
          .flatMap((function (content) { return (content.children.filter(isInput)); }))
          .filter((function (input) { return (!isHiddenInput(input, attributeValue)); }));
        const labelValues = labels.map((function (label) { return (attributeValue(label, 'for')); })).filter(Boolean);
        const inputValues = inputs.map((function (input) { return (attributeValue(input, 'id')); })).filter(Boolean);

        if (!labelValues.length || !inputValues.length) {
            return;
        }

        const mismatch = labelValues.find((function (label) { return (!inputValues.some((function (input) { return (sameElementAttributeValue(input, label)); }))); }))
          ?? inputValues.find((function (input) { return (!labelValues.some((function (label) { return (sameElementAttributeValue(label, input)); }))); }));
        if (!mismatch) return;

        context.report({
          node: mismatch.attribute,
          messageId: 'mismatch',
          data: {
            labels: labelValues.map((function ({ attribute }) { return (sourceCode.getText(attribute)); })).join(', '),
            inputs: inputValues.map((function ({ attribute }) { return (sourceCode.getText(attribute)); })).join(', '),
          },
        });
      },
    });
  },
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the require-fields-to-associate-labels-and-inputs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the require-fields-to-associate-labels-and-inputs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
