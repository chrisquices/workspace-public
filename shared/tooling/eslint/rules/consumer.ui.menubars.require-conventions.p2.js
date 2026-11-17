import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Menubar: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {Comment: {flags: ['required']}},
                {
                    MenubarMenu: {
                        flags: ['required', 'repeatable'],
                        children: [
                            {MenubarTrigger: {flags: ['optional', 'comment-source', 'non-empty']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                MenubarContent: {
                                    flags: ['required', 'unordered', 'non-empty'],
                                    children: [
                                        {Comment: {flags: ['required', 'text:Label']}},
                                        {MenubarLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                        {Comment: {flags: ['required']}},
                                        {MenubarItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                        {MenubarCheckboxItem: {flags: ['optional', 'repeatable', 'non-empty']}},
                                        {Comment: {flags: ['required']}},
                                        {
                                            MenubarRadioGroup: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {MenubarRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {Comment: {flags: ['required', 'text:Separator']}},
                                        {MenubarSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                        {
                                            MenubarGroup: {
                                                flags: ['optional', 'repeatable', 'unordered', 'non-empty'],
                                                children: [
                                                    {Comment: {flags: ['required', 'text:Label']}},
                                                    {MenubarLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                                    {Comment: {flags: ['required']}},
                                                    {MenubarItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                                    {MenubarCheckboxItem: {flags: ['optional', 'repeatable', 'non-empty']}},
                                                    {
                                                        MenubarRadioGroup: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {MenubarRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required', 'text:Separator']}},
                                                    {MenubarSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                ],
                                            },
                                        },
                                        {
                                            MenubarSub: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {MenubarSubTrigger: {flags: ['required', 'non-empty']}},
                                                    {
                                                        MenubarSubContent: {
                                                            flags: ['required', 'unordered', 'non-empty'],
                                                            children: [
                                                                {Comment: {flags: ['required', 'text:Label']}},
                                                                {MenubarLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                                                {Comment: {flags: ['required']}},
                                                                {MenubarItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                                                {MenubarCheckboxItem: {flags: ['optional', 'repeatable', 'non-empty']}},
                                                                {
                                                                    MenubarRadioGroup: {
                                                                        flags: ['optional', 'repeatable'],
                                                                        children: [
                                                                            {MenubarRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                                        ],
                                                                    },
                                                                },
                                                                {Comment: {flags: ['required', 'text:Separator']}},
                                                                {MenubarSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                                {
                                                                    MenubarGroup: {
                                                                        flags: ['optional', 'repeatable', 'unordered', 'non-empty'],
                                                                        children: [
                                                                            {Comment: {flags: ['required', 'text:Label']}},
                                                                            {MenubarLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                                                            {Comment: {flags: ['required']}},
                                                                            {MenubarItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                                                            {MenubarCheckboxItem: {flags: ['optional', 'repeatable', 'non-empty']}},
                                                                            {
                                                                                MenubarRadioGroup: {
                                                                                    flags: ['optional', 'repeatable'],
                                                                                    children: [
                                                                                        {MenubarRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                                                    ],
                                                                                },
                                                                            },
                                                                            {Comment: {flags: ['required', 'text:Separator']}},
                                                                            {MenubarSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                                        ],
                                                                    },
                                                                },
                                                                {MenubarSub: {flags: ['optional', 'repeatable']}},
                                                            ],
                                                        },
                                                    },
                                                ],
                                            },
                                        },
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

export const shortcutStructure = [
    {MenubarShortcut: {flags: ['required', 'single-liner', 'non-empty']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(shortcutStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the menubars UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the menubars UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
