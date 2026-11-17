import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

// Command and CommandDialog share slotted input/list markup; CommandDialog creates its own Command internally.
export const structure = [
    {Comment: {flags: ['required']}},
    {Command: {flags: ['required', 'non-empty', 'blank-line-after-if-next-sibling']}},
];

export const dialogStructure = [
    {Comment: {flags: ['required']}},
    {CommandDialog: {flags: ['required', 'comment-source:title', 'non-empty']}},
];

export const inputStructure = [
    {CommandInput: {flags: ['required', 'single-liner']}},
];

export const listStructure = [
    {
        CommandList: {
            flags: ['required', 'unordered', 'non-empty'],
            children: [
                {CommandEmpty: {flags: ['optional']}},
                {Comment: {flags: ['required']}},
                {CommandItem: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                {Comment: {flags: ['required', 'text:Separator']}},
                {CommandSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                {Comment: {flags: ['required']}},
                {
                    CommandGroup: {
                        flags: ['optional', 'repeatable', 'comment-source:heading'],
                        children: [
                            {Comment: {flags: ['required']}},
                            {CommandItem: {flags: ['required', 'repeatable', 'comment-source', 'non-empty']}},
                        ],
                    },
                },
            ],
        },
    },
];

export const shortcutStructure = [
    {CommandShortcut: {flags: ['required', 'single-liner', 'non-empty']}},
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(dialogStructure),
    ...createComponentRules(inputStructure),
    ...createComponentRules(listStructure),
    ...createComponentRules(shortcutStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the commands UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the commands UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
