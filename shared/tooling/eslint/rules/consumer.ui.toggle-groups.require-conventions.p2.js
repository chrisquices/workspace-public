import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        ToggleGroup: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {Comment: {flags: ['required']}},
                {ToggleGroupItem: {flags: ['required', 'repeatable', 'comment-source', 'non-empty', 'multi-liner']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the toggle-groups UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the toggle-groups UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
