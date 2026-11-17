import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {
        Bubble: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {BubbleContent: {flags: ['required', 'comment-source', 'single-liner-attributes']}},
                {BlankLine: {flags: ['required']}},
                {BubbleReactions: {flags: ['optional']}},
            ],
        },
    },
];

export const groupStructure = [
    {Comment: {flags: ['required']}},
    {
        BubbleGroup: {
            flags: ['required'],
            children: [
                {Bubble: {flags: ['required', 'repeatable']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),

    // Each Bubble validates its own contents and props, including when grouped.
    ...createComponentRules(groupStructure, {propsScope: 'root'}),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the bubbles UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the bubbles UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
