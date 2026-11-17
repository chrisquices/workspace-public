import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';
import {getTableColumnCommentSource} from '#eslint/helpers/get-table-column-comment-source.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Table: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {TableCaption: {flags: ['optional', 'comment-source', 'single-liner']}},
                {
                    TableHeader: {
                        flags: ['required', 'blank-line-between-children'],
                        children: [
                            {
                                TableRow: {
                                    flags: ['required', 'repeatable'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {TableHead: {flags: ['required', 'repeatable', 'comment-source', 'multi-liner', 'non-empty']}},
                                    ],
                                },
                            },
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    TableBody: {
                        flags: ['required', 'unordered', 'non-empty'],
                        children: [
                            {Comment: {flags: ['required']}},
                            {
                                TableRow: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {Comment: {flags: ['required', 'comment-from:TableHead']}},
                                        {TableCell: {flags: ['required', 'repeatable', 'multi-liner']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required']}},
                            {
                                ContextMenu: {
                                    flags: ['optional', 'repeatable'],
                                    children: [
                                        {
                                            ContextMenuTrigger: {
                                                flags: ['required'],
                                                attributes: {'as-child': ['required']},
                                                children: [
                                                    {
                                                        TableRow: {
                                                            flags: ['required'],
                                                            children: [
                                                                {Comment: {flags: ['required', 'comment-from:TableHead']}},
                                                                {TableCell: {flags: ['required', 'repeatable', 'multi-liner']}},
                                                            ],
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                        {ContextMenuContent: {flags: ['required', 'non-empty']}},
                                    ],
                                },
                            },
                            {Comment: {flags: ['required']}},
                            {TableEmpty: {flags: ['optional']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    TableFooter: {
                        flags: ['optional'],
                        children: [
                            {
                                TableRow: {
                                    flags: ['required', 'repeatable'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {TableCell: {flags: ['required', 'repeatable', 'multi-liner']}},
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
    'Require Table family structure, props, comments, spacing, and layout conventions.',
    createComponentRules(structure, {
        commentMatchers: {TableHead: getTableColumnCommentSource},
    }),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the tables UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the tables UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
