import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        MessageScroller: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    MessageScrollerViewport: {
                        flags: ['required'],
                        children: [
                            {
                                MessageScrollerContent: {
                                    flags: ['required'],
                                    children: [
                                        {MessageScrollerItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                    ],
                                },
                            },
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {MessageScrollerButton: {flags: ['optional', 'repeatable', 'single-liner']}},
            ],
        },
    },
];

export const providerStructure = [
    {MessageScrollerProvider: {flags: ['required', 'non-empty']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(providerStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the message-scrollers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the message-scrollers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
