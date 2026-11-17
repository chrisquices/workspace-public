import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        RadioGroup: {
            flags: ['required', 'non-empty', 'blank-line-after-if-next-sibling'],
            children: [
                {Comment: {flags: ['required']}},
                {
                    Field: {
                        flags: ['required', 'repeatable'],
                        attributes: {
                            orientation: ['value:horizontal'],
                        },
                        children: [
                            {
                                RadioGroupItem: {
                                    flags: ['required', 'single-liner'],
                                    attributes: {
                                        id: ['non-empty'],
                                    },
                                },
                            },
                            {
                                FieldContent: {
                                    flags: ['required'],
                                    children: [
                                        {
                                            FieldLabel: {
                                                flags: ['required', 'comment-source', 'single-liner', 'non-empty'],
                                                attributes: {
                                                    for: ['non-empty', 'matches:RadioGroupItem.id'],
                                                },
                                            },
                                        },
                                        {FieldDescription: {flags: ['optional', 'single-liner', 'non-empty']}},
                                        {FieldError: {flags: ['optional']}},
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

export const itemStructure = [
    {RadioGroupItem: {flags: ['required', 'single-liner']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(itemStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the radio-groups UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the radio-groups UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
