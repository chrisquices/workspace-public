import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Avatar: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {AvatarImage: {flags: ['required', 'comment-source:alt', 'single-liner']}},
                {AvatarFallback: {flags: ['required', 'comment-source', 'multi-liner']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the avatars UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the avatars UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
