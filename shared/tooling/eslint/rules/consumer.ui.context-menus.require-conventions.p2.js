import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

// Keep ContextMenu composition, labels, comments, spacing, and layout in one
// component rule. Share item flags across direct, grouped, and submenu items.

import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import { hasLabelIcon } from '#eslint/helpers/has-label-icon.js';
import { getImportedLucideIcons } from '#eslint/helpers/get-imported-lucide-icons.js';
import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

const contextMenuItemFlags = [
    'optional',
    'repeatable',
    'label-required',
    'label-after-first-icon',
    'label-sr-only-when-dynamic',
    'no-blank-line-between-children',
    'comment-source',
    'non-empty',
    'multi-liner',
    'single-liner-attributes-otherwise-multi-liner-at-4',
];

const labelContainer = {
    ContextMenuLabelContainer: {
        flags: ['optional', 'repeatable', 'non-empty'],
        children: [
            {Comment: {flags: ['required']}},
            {Badge: {flags: ['optional', 'multi-liner', 'non-empty']}},
            {Comment: {flags: ['required', 'text:Label']}},
            {ContextMenuLabel: {flags: ['required', 'repeatable', 'multi-liner', 'non-empty']}},
        ],
    },
};

export const structure = [
    {Comment: {flags: ['required']}},
    {
        ContextMenu: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {ContextMenuTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {
                    ContextMenuContent: {
                        flags: ['required', 'unordered', 'non-empty', 'blank-line-between-children'],
                        children: [
                            {Comment: {flags: ['required', 'text:Label']}},
                            {ContextMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                            {Comment: {flags: ['required', 'text:Labels']}},
                            {
                                ContextMenuLabelContainer: {
                                    ...labelContainer.ContextMenuLabelContainer,
                                    flags: ['required', 'repeatable', 'non-empty', 'first-in-parent'],
                                },
                            },
                            {Comment: {flags: ['required']}},
                            {ContextMenuItem: {flags: contextMenuItemFlags}},
                            {Comment: {flags: ['required']}},
                            {ContextMenuCheckboxItem: {flags: contextMenuItemFlags}},
                            {Comment: {flags: ['required']}},
                            {
                                ContextMenuRadioGroup: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {ContextMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required', 'text:Separator']}},
                            {ContextMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                ContextMenuGroup: {
                                    flags: ['optional', 'repeatable', 'unordered', 'non-empty'],
                                    children: [
                                        {Comment: {flags: ['required', 'text:Label']}},
                                        {ContextMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                                        {Comment: {flags: ['required', 'text:Labels']}},
                                        labelContainer,
                                        {Comment: {flags: ['required']}},
                                        {ContextMenuItem: {flags: contextMenuItemFlags}},
                                        {Comment: {flags: ['required']}},
                                        {ContextMenuCheckboxItem: {flags: contextMenuItemFlags}},
                                        {Comment: {flags: ['required']}},
                                        {
                                            ContextMenuRadioGroup: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {ContextMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {Comment: {flags: ['required', 'text:Separator']}},
                                        {ContextMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required']}},
                            {
                                ContextMenuSub: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {ContextMenuSubTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                                        {
                                            ContextMenuSubContent: {
                                                flags: ['required', 'unordered', 'non-empty'],
                                                children: [
                                                    {Comment: {flags: ['required', 'text:Label']}},
                                                    {ContextMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                                                    {Comment: {flags: ['required', 'text:Labels']}},
                                                    labelContainer,
                                                    {Comment: {flags: ['required']}},
                                                    {ContextMenuItem: {flags: contextMenuItemFlags}},
                                                    {Comment: {flags: ['required']}},
                                                    {ContextMenuCheckboxItem: {flags: contextMenuItemFlags}},
                                                    {Comment: {flags: ['required']}},
                                                    {
                                                        ContextMenuRadioGroup: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {ContextMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required', 'text:Separator']}},
                                                    {ContextMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                    {BlankLine: {flags: ['required']}},
                                                    {
                                                        ContextMenuGroup: {
                                                            flags: ['optional', 'repeatable', 'unordered', 'non-empty'],
                                                            children: [
                                                                {Comment: {flags: ['required', 'text:Label']}},
                                                                {ContextMenuLabel: {flags: ['optional', 'repeatable', 'multi-liner', 'non-empty']}},
                                                                {Comment: {flags: ['required', 'text:Labels']}},
                                                                labelContainer,
                                                                {Comment: {flags: ['required']}},
                                                                {ContextMenuItem: {flags: contextMenuItemFlags}},
                                                                {Comment: {flags: ['required']}},
                                                                {ContextMenuCheckboxItem: {flags: contextMenuItemFlags}},
                                                                {Comment: {flags: ['required']}},
                                                                {
                                                                    ContextMenuRadioGroup: {
                                                                        flags: ['optional', 'repeatable'],
                                                                        children: [
                                                                            {ContextMenuRadioItem: {flags: ['required', 'repeatable', 'non-empty']}},
                                                                        ],
                                                                    },
                                                                },
                                                                {Comment: {flags: ['required', 'text:Separator']}},
                                                                {ContextMenuSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required']}},
                                                    {
                                                        ContextMenuSub: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {ContextMenuSubTrigger: {flags: ['required', 'comment-source', 'non-empty']}},
                                                                {ContextMenuSubContent: {flags: ['required', 'non-empty']}},
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
    {ContextMenuShortcut: {flags: ['required', 'single-liner', 'non-empty']}},
];

const uiRuleOrChecks = combineUiRules('Require ContextMenu structure, labels, comments, spacing, and layout conventions.', {
    ...createComponentRules(structure),
    ...createComponentRules(shortcutStructure),
    'require-contextmenu-label-icon': {
        meta: {
            type: 'problem',
            docs: {description: 'Require a Lucide icon or dynamic icon component inside every ContextMenuLabel.'},
            schema: [],
            messages: {
                missingIcon: 'Add a Lucide icon or a dynamic <component :is="…"> icon inside <ContextMenuLabel>. Preserve the existing label text and bindings.',
            },
        },
        create(context) {
            const sourceCode = context.sourceCode;
            const services = sourceCode.parserServices;

            if (!services.defineTemplateBodyVisitor) {
                return {};
            }

            const icons = getImportedLucideIcons(sourceCode.ast);

            return services.defineTemplateBodyVisitor({
                VElement(node) {
                    if (!matchesVueComponentName(node, 'ContextMenuLabel') || hasLabelIcon(node, icons)) {
                        return;
                    }

                    context.report({loc: node.startTag.loc, messageId: 'missingIcon'});
                },
            });
        },
    },
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the context-menus UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the context-menus UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
