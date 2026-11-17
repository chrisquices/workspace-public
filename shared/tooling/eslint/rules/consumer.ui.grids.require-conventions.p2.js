import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Grid: {
            flags: ['required', 'blank-line-after-if-next-sibling', 'multi-liner-attributes'],
            children: [
                {
                    GridItem: {
                        flags: ['required', 'repeatable', 'multi-liner-attributes'],
                        children: [
                            {Comment: {flags: ['required']}},
                            {GridItemContent: {flags: ['required', 'non-empty']}},
                            {Comment: {flags: ['required']}},
                            {GridItemOverlay: {flags: ['optional']}},
                            {Comment: {flags: ['required']}},
                            {GridItemLabel: {flags: ['optional', 'comment-source', 'comment-source:name', 'single-liner:unless-child-elements']}},
                            {Comment: {flags: ['required']}},
                            {
                                GridItemAction: {
                                    flags: ['optional', 'blank-line-between-children'],
                                    children: [
                                        {GridItemActionRemove: {flags: ['optional', 'single-liner']}},
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
    'Require Grid family structure, props, comments, spacing, and layout conventions.',
    createComponentRules(structure, {propsScope: 'family'}),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the grids UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the grids UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
