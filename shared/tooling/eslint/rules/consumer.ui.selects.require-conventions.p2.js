import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Select: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    SelectTrigger: {
                        flags: ['required'],
                        children: [
                            {SelectValue: {flags: ['required', 'single-liner']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    SelectContent: {
                        flags: ['required', 'unordered', 'non-empty', 'blank-line-between-children'],
                        children: [
                            {SelectLabel: {flags: ['optional', 'single-liner', 'non-empty']}},
                            {SelectItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {SelectSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                SelectGroup: {
                                    flags: ['optional', 'repeatable', 'no-blank-line-between-children', 'no-direct-child-comments'],
                                    children: [
                                        {SelectLabel: {flags: ['optional', 'single-liner', 'non-empty']}},
                                        {SelectItem: {flags: ['required', 'repeatable', 'comment-source', 'non-empty']}},
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the selects UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the selects UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
