import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

const findContainingForm = (function (node) {
  for (let parent = node.parent; parent?.type === 'VElement'; parent = parent.parent) {
    if (parent.rawName === 'form') return parent;
  }

  return undefined;
});

// Report only: choosing and importing a replacement component requires a manual edit.
const uiRuleOrChecks = {
  meta: {
    type: 'suggestion',
    docs: { description: 'forbid native label elements in Vue templates' },
    schema: [],
    messages: { forbidden: '{{ instruction }}' },
  },

  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services.defineTemplateBodyVisitor) return {};

    return services.defineTemplateBodyVisitor({
      VElement(node) {
        if (node.rawName !== 'label') return;

        const instruction = findContainingForm(node)
          ? 'Inside <form>, replace native <label> with <FieldLabel> directly inside <Field>; <Label> is also forbidden here. Preserve the label text and for binding, and import FieldLabel from the project\'s UI kit if needed.'
          : 'Replace native <label> with the UI kit\'s <Label>, or <FieldLabel> directly inside <Field> when using the Field structure. Preserve the label text and for binding, and import the chosen component if needed.';

        context.report({
          loc: node.startTag.loc,
          messageId: 'forbidden',
          data: { instruction: instruction },
        });
      },
    });
  },
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the no-native-labels UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the no-native-labels UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
