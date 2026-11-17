import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

// Keep DropdownMenu composition, props, comments, spacing, and layout together as
// one component rule. The shared helpers interpret the definitions below. Add
// DropdownMenu-specific checks to the combined check map at the end of this file.

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';
import { hasAsChild } from '#eslint/helpers/match-component-structure.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

const dropdownMenuItemFlags = [
    'optional',
    'repeatable',
    'label-required',
    'label-after-first-icon',
    'label-sr-only-when-dynamic',
    'comment-source',
    'non-empty',
    'single-liner-attributes-otherwise-multi-liner-at-4'
];

const dropdownMenuCheckboxItemFlags = [
    'optional',
    'repeatable',
    'label-required',
    'label-after-first-icon',
    'label-sr-only-when-dynamic',
    'no-blank-line-between-children',
    'comment-source',
    'non-empty',
    'single-liner-attributes-otherwise-multi-liner-at-4'
];

export const structure = [
    {Comment: {flags: ['required']}},
    {
        DropdownMenu: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    Group: {
                        flags: ['required', 'one-of'],
                        children: [
                            {DropdownMenuTrigger: {flags: ['required', 'comment-source', 'non-empty', 'single-liner']}},
                            {
                                BreadcrumbLink: {
                                    flags: ['required'],
                                    children: [
                                        {DropdownMenuTrigger: {flags: ['required', 'comment-source', 'non-empty', 'single-liner']}},
                                    ],
                                },
                            },
                            {
                                Tooltip: {
                                    flags: ['required'],
                                    children: [
                                        {
                                            TooltipTrigger: {
                                                flags: ['required'],
                                                children: [
                                                    {DropdownMenuTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {BlankLine: {flags: ['required']}},
                                        {TooltipContent: {flags: ['required', 'non-empty']}},
                                    ],
                                },
                            },
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    DropdownMenuContent: {
                        flags: ['required', 'unordered', 'non-empty', 'blank-line-between-children', 'single-liner-attributes'],
                        children: [
                            {Comment: {flags: ['required', 'text:Label']}},
                            {DropdownMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                            {Comment: {flags: ['required']}},
                            {Slider: {flags: ['optional', 'single-liner']}},
                            {Comment: {flags: ['required']}},
                            {DropdownMenuItem: {flags: dropdownMenuItemFlags}},
                            {Comment: {flags: ['required']}},
                            {DropdownMenuCheckboxItem: {flags: dropdownMenuCheckboxItemFlags}},
                            {BlankLine: {flags: ['required']}},
                            {
                                DropdownMenuRadioGroup: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {DropdownMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty', 'single-liner']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {DropdownMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                DropdownMenuGroup: {
                                    flags: ['optional', 'repeatable', 'unordered', 'non-empty', 'single-liner-attributes'],
                                    children: [
                                        {Comment: {flags: ['required', 'text:Label']}},
                                        {DropdownMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                                        {Comment: {flags: ['required']}},
                                        {DropdownMenuItem: {flags: dropdownMenuItemFlags}},
                                        {Comment: {flags: ['required']}},
                                        {DropdownMenuCheckboxItem: {flags: dropdownMenuCheckboxItemFlags}},
                                        {Comment: {flags: ['required']}},
                                        {
                                            DropdownMenuRadioGroup: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {DropdownMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {Comment: {flags: ['required', 'text:Separator']}},
                                        {DropdownMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required']}},
                            {
                                DropdownMenuSub: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {DropdownMenuSubTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                                        {
                                            DropdownMenuSubContent: {
                                                flags: ['required', 'unordered', 'non-empty'],
                                                children: [
                                                    {Comment: {flags: ['required', 'text:Label']}},
                                                    {DropdownMenuLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                                    {Comment: {flags: ['required']}},
                                                    {DropdownMenuItem: {flags: dropdownMenuItemFlags}},
                                                    {Comment: {flags: ['required']}},
                                                    {DropdownMenuCheckboxItem: {flags: dropdownMenuCheckboxItemFlags}},
                                                    {Comment: {flags: ['required']}},
                                                    {
                                                        DropdownMenuRadioGroup: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {DropdownMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required', 'text:Separator']}},
                                                    {DropdownMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                    {BlankLine: {flags: ['required']}},
                                                    {
                                                        DropdownMenuGroup: {
                                                            flags: ['optional', 'repeatable', 'unordered', 'non-empty', 'single-liner-attributes'],
                                                            children: [
                                                                {Comment: {flags: ['required', 'text:Label']}},
                                                                {DropdownMenuLabel: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty']}},
                                                                {Comment: {flags: ['required']}},
                                                                {DropdownMenuItem: {flags: dropdownMenuItemFlags}},
                                                                {Comment: {flags: ['required']}},
                                                                {DropdownMenuCheckboxItem: {flags: dropdownMenuCheckboxItemFlags}},
                                                                {Comment: {flags: ['required']}},
                                                                {
                                                                    DropdownMenuRadioGroup: {
                                                                        flags: ['optional', 'repeatable'],
                                                                        children: [
                                                                            {DropdownMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                                        ],
                                                                    },
                                                                },
                                                                {Comment: {flags: ['required', 'text:Separator']}},
                                                                {DropdownMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required']}},
                                                    {
                                                        DropdownMenuSub: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {DropdownMenuSubTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                                                                {DropdownMenuSubContent: {flags: ['required', 'non-empty']}},
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
    {DropdownMenuShortcut: {flags: ['required', 'single-liner', 'non-empty']}},
];

const uiRuleOrChecks = combineUiRules('Require DropdownMenu structure, props, attributes, comments, spacing, and layout conventions.', {
    ...createComponentRules(structure),
    ...createComponentRules(shortcutStructure),
    breadcrumbTrigger: {
        meta: {
            messages: {
                breadcrumbAsChild: 'Enable as-child on <BreadcrumbLink> wrapping <DropdownMenuTrigger> so the trigger receives its behavior.',
            },
        },
        create(context) {
            const services = context.sourceCode.parserServices;
            if (!services.defineTemplateBodyVisitor) return {};

            return services.defineTemplateBodyVisitor({
                VElement(node) {
                    if (!matchesVueComponentName(node, 'BreadcrumbLink')
                        || !matchesVueComponentName(node.parent, 'DropdownMenu')
                        || hasAsChild(node)) return;

                    context.report({ node: node.startTag, messageId: 'breadcrumbAsChild' });
                },
            });
        },
    },
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the dropdown-menus UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the dropdown-menus UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
