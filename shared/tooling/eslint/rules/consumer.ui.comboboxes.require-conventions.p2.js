import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Combobox: {
            flags: ['required', 'multi-liner-attributes', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    ComboboxAnchor: {
                        flags: ['required', 'unordered', 'non-empty'],
                        children: [
                            {ComboboxInput: {flags: ['optional', 'single-liner']}},
                            {ComboboxTrigger: {flags: ['optional', 'comment-source', 'non-empty']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    ComboboxList: {
                        flags: ['required', 'unordered', 'non-empty'],
                        children: [
                            {ComboboxInput: {flags: ['optional', 'single-liner']}},
                            {
                                ComboboxViewport: {
                                    flags: ['optional', 'unordered', 'non-empty'],
                                    children: [
                                        {ComboboxEmpty: {flags: ['optional', 'single-liner']}},
                                        {Comment: {flags: ['required']}},
                                        {ComboboxItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                        {Comment: {flags: ['required', 'text:Separator']}},
                                        {ComboboxSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                        {
                                            ComboboxGroup: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {Comment: {flags: ['required']}},
                                                    {ComboboxItem: {flags: ['required', 'repeatable', 'comment-source', 'non-empty']}},
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                            {ComboboxEmpty: {flags: ['optional', 'single-liner']}},
                            {Comment: {flags: ['required']}},
                            {ComboboxItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {ComboboxSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                            {
                                ComboboxGroup: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {ComboboxItem: {flags: ['required', 'repeatable', 'comment-source', 'non-empty']}},
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

export const indicatorStructure = [
    {ComboboxItemIndicator: {flags: ['required']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(indicatorStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the comboboxes UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the comboboxes UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
