import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {Progress: {flags: ['required', 'single-liner', 'blank-line-after-if-next-sibling']}},
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the Progress UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the Progress UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
