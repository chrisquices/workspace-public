import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Alert: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {AlertTitle: {flags: ['required', 'comment-source', 'single-liner']}},
                {AlertDescription: {flags: ['required', 'comment-source', 'single-liner']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the alerts UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the alerts UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
