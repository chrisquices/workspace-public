import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {
        InputGroup: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {InputGroupAddon: {flags: ['optional', 'repeatable']}},
                {
                    Group: {
                        flags: ['required', 'one-of'],
                        children: [
                            {InputGroupInput: {flags: ['required', 'multi-liner-attributes']}},
                            {InputGroupTextarea: {flags: ['required', 'single-liner']}},
                        ],
                    },
                },
                {InputGroupAddon: {flags: ['optional', 'repeatable']}},
            ],
        },
    },
];

export const buttonStructure = [
    {Comment: {flags: ['required']}},
    {InputGroupButton: {flags: ['required', 'comment-source', 'multi-liner', 'non-empty']}},
];

export const textStructure = [
    {InputGroupText: {flags: ['required', 'single-liner', 'non-empty']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(buttonStructure),
    ...createComponentRules(textStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the input-groups UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the input-groups UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
