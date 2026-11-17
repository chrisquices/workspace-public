import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        AlertDialog: {
            flags: ['required', 'top-level', 'last-in-template', 'multi-liner-attributes', 'blank-line-after-if-next-sibling'],
            attributes: {
                dismissible: ['required-if-bound:open', 'bound'],
                processing: ['required-if-bound:open', 'bound'],
                '@update:open': ['required-if-bound:open'],
            },
            children: [
                {
                    AlertDialogContent: {
                        flags: ['required'],
                        children: [
                            {
                                AlertDialogHeader: {
                                    flags: ['required'],
                                    children: [
                                        {AlertDialogIcon: {flags: ['optional']}},
                                        {AlertDialogTitle: {flags: ['required', 'comment-source', 'single-liner:unless-child-elements']}},
                                        {AlertDialogDescription: {flags: ['required', 'comment-source', 'single-liner']}},
                                    ],
                                },
                            },
                            {BlankLine: {flags: ['required']}},
                            {
                                AlertDialogFooter: {
                                    flags: ['required'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {AlertDialogAction: {flags: ['required', 'comment-source']}},
                                        {Comment: {flags: ['optional']}},
                                        {AlertDialogCancel: {flags: ['optional', 'comment-source'], attributes: {'as-child': ['required-if-descendant:Button']}}},
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

const uiRuleOrChecks = combineUiRules(
    'Require AlertDialog structure, props, attributes, comments, placement, spacing, and layout conventions.',
    createComponentRules(structure, {
        forbiddenMessage: 'Do not use <{{ element }}>. Control <{{ root }}> with v-model:open or :open and @update:open; keep the opener outside <{{ root }}> and preserve its behavior.',
    }),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the alert-dialogs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the alert-dialogs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
