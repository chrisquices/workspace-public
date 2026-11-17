import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Marker: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {MarkerIcon: {flags: ['optional']}},
                {MarkerContent: {flags: ['required', 'comment-source', 'single-liner-attributes', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the markers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the markers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
