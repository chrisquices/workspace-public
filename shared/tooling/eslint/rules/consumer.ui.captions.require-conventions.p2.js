import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {Caption: {flags: ['required', 'comment-source', 'single-liner', 'non-empty', 'blank-line-after-if-next-sibling', 'label-required', 'label-sr-only-when-dynamic']}},
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the captions UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the captions UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
