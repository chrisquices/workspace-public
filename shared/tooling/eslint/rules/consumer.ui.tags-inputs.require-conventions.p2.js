import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        TagsInput: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    TagsInputItem: {
                        flags: ['optional', 'repeatable', 'multi-liner'],
                        children: [
                            {TagsInputItemText: {flags: ['required', 'single-liner']}},
                            {TagsInputItemDelete: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
                {TagsInputInput: {flags: ['required', 'single-liner']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the tags-inputs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the tags-inputs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
