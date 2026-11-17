import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Pagination: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    PaginationContent: {
                        flags: ['required', 'unordered'],
                        children: [
                            {PaginationFirst: {flags: ['optional', 'single-liner']}},
                            {PaginationPrevious: {flags: ['optional', 'single-liner']}},
                            {PaginationItem: {flags: ['required', 'repeatable', 'non-empty']}},
                            {PaginationEllipsis: {flags: ['optional', 'repeatable', 'single-liner']}},
                            {PaginationNext: {flags: ['optional', 'single-liner']}},
                            {PaginationLast: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the Pagination UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the Pagination UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
