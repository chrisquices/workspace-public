import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Message: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {MessageAvatar: {flags: ['optional']}},
                {
                    MessageContent: {
                        flags: ['required'],
                        children: [
                            {MessageHeader: {flags: ['optional', 'comment-source', 'single-liner']}},
                            {Bubble: {flags: ['optional', 'repeatable']}},
                            {BubbleGroup: {flags: ['optional']}},
                            {MessageFooter: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
            ],
        },
    },
];

export const groupStructure = [
    {
        MessageGroup: {
            flags: ['required'],
            children: [
                {Message: {flags: ['required', 'repeatable']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure, {propsScope: 'family'}),
    ...createComponentRules(groupStructure, {propsScope: 'root'}),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the messages UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the messages UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
