import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

// Keep the Sidebar family definitions and its component-specific parent exception
// together as one rule. Shared helpers supply structure, props, attributes,
// comments, spacing, and layout checks for every declared Sidebar root below.

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Sidebar: {
            flags: ['required', 'blank-line-between-children'],
            attributes: {collapsible: ['required'], size: ['required']},
            children: [
                {SidebarHeader: {flags: ['optional']}},
                {Comment: {flags: ['required', 'text:Separator']}},
                {SidebarSeparator: {flags: ['optional', 'single-liner']}},
                {SidebarContent: {flags: ['required', 'non-empty', 'blank-line-between-children', 'single-liner-attributes']}},
                {Comment: {flags: ['required', 'text:Separator']}},
                {SidebarSeparator: {flags: ['optional', 'single-liner']}},
                {SidebarFooter: {flags: ['optional']}},
                {Comment: {flags: ['required']}},
                {SidebarRail: {flags: ['optional', 'single-liner']}},
            ],
        },
    },
];

export const providerStructure = [
    {SidebarProvider: {flags: ['required', 'non-empty', 'blank-line-between-children', 'single-liner-attributes']}},
];

export const insetStructure = [
    {SidebarInset: {flags: ['required', 'non-empty']}},
];

export const triggerStructure = [
    {SidebarTrigger: {flags: ['required', 'single-liner']}},
];

export const inputStructure = [
    {SidebarInput: {flags: ['required', 'single-liner']}},
];

export const groupStructure = [
    {Comment: {flags: ['required']}},
    {
        SidebarGroup: {
            flags: ['required', 'blank-line-between-children'],
            children: [
                {SidebarGroupLabel: {flags: ['optional', 'comment-source', 'multi-liner', 'non-empty']}},
                {SidebarGroupAction: {flags: ['optional', 'non-empty']}},
                {SidebarGroupContent: {flags: ['required', 'non-empty']}},
            ],
        },
    },
];

export const menuStructure = [
    {
        SidebarMenu: {
            flags: ['required', 'blank-line-between-children'],
            children: [
                {
                    SidebarMenuItem: {
                        flags: ['required', 'repeatable', 'blank-line-between-children'],
                        children: [
                            {
                                Group: {
                                    flags: ['required', 'one-of'],
                                    children: [
                                        {SidebarMenuButton: {flags: ['required', 'non-empty', 'single-liner-attributes']}},
                                        {SidebarMenuSkeleton: {flags: ['required', 'single-liner']}},
                                        {
                                            Tooltip: {
                                                flags: ['required'],
                                                children: [
                                                    {
                                                        TooltipTrigger: {
                                                            flags: ['required'],
                                                            children: [
                                                                {SidebarMenuButton: {flags: ['required', 'non-empty', 'single-liner-attributes']}},
                                                            ],
                                                        },
                                                    },
                                                    {TooltipContent: {flags: ['required', 'non-empty']}},
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                            {SidebarMenuAction: {flags: ['optional', 'non-empty']}},
                            {SidebarMenuBadge: {flags: ['optional', 'single-liner', 'non-empty']}},
                            {
                                SidebarMenuSub: {
                                    flags: ['optional', 'single-liner-attributes', 'blank-line-between-children'],
                                    children: [
                                        {
                                            SidebarMenuSubItem: {
                                                flags: ['required', 'repeatable', 'single-liner-attributes'],
                                                children: [
                                                    {SidebarMenuSubButton: {flags: ['required', 'non-empty', 'single-liner-attributes']}},
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

const uiRuleOrChecks = combineUiRules('Require Sidebar family structure, props, attributes, comments, spacing, and layout conventions.', {
    ...createComponentRules(structure, {
        allowAdditionalParent(node) {
            if (!matchesVueComponentName(node, 'SidebarSeparator')) {
                return false;
            }

            let parent = node.parent;
            while (parent?.type === 'VElement' && parent.rawName.toLowerCase() === 'template') parent = parent.parent;

            return matchesVueComponentName(parent, 'SidebarContent');
        },
    }),
    ...createComponentRules(providerStructure),
    ...createComponentRules(insetStructure),
    ...createComponentRules(triggerStructure),
    ...createComponentRules(inputStructure),
    ...createComponentRules(groupStructure),
    ...createComponentRules(menuStructure),
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the sidebars UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the sidebars UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
