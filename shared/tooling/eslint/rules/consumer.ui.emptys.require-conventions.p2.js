import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Empty: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    EmptyHeader: {
                        flags: ['required'],
                        children: [
                            {EmptyMedia: {flags: ['optional', 'multi-liner']}},
                            {EmptyTitle: {flags: ['required', 'comment-source', 'single-liner']}},
                            {EmptyDescription: {flags: ['optional', 'comment-source', 'single-liner']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    EmptyContent: {
                        flags: ['optional'],
                        children: [
                            {Button: {flags: ['required', 'repeatable']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = combineUiRules(
    'Require Empty structure, family props, comments, spacing, and layout conventions.',
    createComponentRules(structure, {propsScope: 'family'}),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the emptys UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the emptys UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
