import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

const findContainingForm = (function (node) {
  for (let parent = node.parent; parent?.type === 'VElement'; parent = parent.parent) {
    if (parent.rawName === 'form') return parent;
  }

  return undefined;
});

const uiRuleOrChecks = {
  meta: {
    type: 'problem',
    docs: { description: 'forbid Label components inside native forms' },
    schema: [],
    messages: { forbidden: 'Do not use <Label> inside <form>. Replace it with <FieldLabel> directly inside <Field>, preserving its text and for binding; import FieldLabel if needed.' },
  },

  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services.defineTemplateBodyVisitor) return {};

    return services.defineTemplateBodyVisitor({
      VElement(node) {
        if (node.rawName === 'Label' && findContainingForm(node)) {
          context.report({ loc: node.startTag.loc, messageId: 'forbidden' });
        }
      },
    });
  },
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the no-labels-in-forms UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the no-labels-in-forms UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
