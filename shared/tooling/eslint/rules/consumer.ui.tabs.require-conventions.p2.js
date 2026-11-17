import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Tabs: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    TabsList: {
                        flags: ['required'],
                        children: [
                            {TabsTrigger: {flags: ['required', 'repeatable', 'comment-source', 'single-liner', 'non-empty']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {Comment: {flags: ['required']}},
                {TabsContent: {flags: ['required', 'repeatable', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the tabs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the tabs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
