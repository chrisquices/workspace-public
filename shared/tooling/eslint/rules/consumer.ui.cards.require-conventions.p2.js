import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Card: {
            flags: ['required', 'multi-liner', 'single-liner-attributes', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    CardHeader: {
                        flags: ['required', 'multi-liner'],
                        children: [
                            {CardTitle: {flags: ['required', 'comment-source', 'single-liner:unless-child-elements', 'non-empty']}},
                            {CardDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                            {CardAction: {flags: ['optional', 'non-empty', 'multi-liner']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {CardContent: {flags: ['required', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {CardFooter: {flags: ['optional', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the cards UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the cards UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
