import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Popover: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {PopoverAnchor: {flags: ['optional', 'non-empty']}},
                {PopoverTrigger: {flags: ['optional', 'comment-source', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {PopoverContent: {flags: ['required', 'non-empty']}},
            ],
        },
    },
];

export const headerStructure = [
    {
        PopoverHeader: {
            flags: ['required'],
            children: [
                {PopoverTitle: {flags: ['required', 'single-liner', 'non-empty']}},
                {PopoverDescription: {flags: ['optional', 'single-liner', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {PopoverAction: {flags: ['optional', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(headerStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the popovers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the popovers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
