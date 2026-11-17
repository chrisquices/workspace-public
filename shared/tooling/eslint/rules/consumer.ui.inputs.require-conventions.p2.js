import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required', 'not-within:FieldContent']}},
    {Input: {
        flags: ['required', 'multi-liner-attributes', 'blank-line-after-if-next-sibling'],
        attributes: {id: ['required', 'non-empty'], type: ['required', 'non-empty']},
    }},
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the inputs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the inputs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
