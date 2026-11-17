import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        InputOTP: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    InputOTPGroup: {
                        flags: ['required'],
                        children: [
                            {InputOTPSlot: {flags: ['required', 'repeatable', 'single-liner']}},
                        ],
                    },
                },
                {
                    Group: {
                        flags: ['optional', 'repeatable'],
                        children: [
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {InputOTPSeparator: {flags: ['required', 'single-liner']}},
                            {
                                InputOTPGroup: {
                                    flags: ['required'],
                                    children: [
                                        {InputOTPSlot: {flags: ['required', 'repeatable', 'single-liner']}},
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

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the input-otps UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the input-otps UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
