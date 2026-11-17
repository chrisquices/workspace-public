import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Collapsible: {
            flags: ['required', 'single-liner-attributes', 'blank-line-after-if-next-sibling'],
            children: [
                {CollapsibleTrigger: {flags: ['optional', 'comment-source', 'non-empty', 'single-liner-attributes']}},
                {BlankLine: {flags: ['required']}},
                {CollapsibleContent: {flags: ['required', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the collapsibles UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the collapsibles UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
