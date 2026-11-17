import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Stepper: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    StepperItem: {
                        flags: ['required', 'repeatable', 'blank-line-between-children'],
                        children: [
                            {
                                StepperTrigger: {
                                    flags: ['required'],
                                    children: [
                                        {StepperIndicator: {flags: ['required', 'non-empty', 'single-liner']}},
                                        {StepperTitle: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                        {StepperDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                    ],
                                },
                            },
                            {StepperTitle: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                            {StepperDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                            {BlankLine: {flags: ['required']}},
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {StepperSeparator: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the steppers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the steppers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
