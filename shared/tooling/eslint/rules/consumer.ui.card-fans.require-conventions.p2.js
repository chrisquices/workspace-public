import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        CardFan: {
            flags: ['required', 'non-empty'],
            attributes: {
                items: ['required', 'bound', 'non-empty'],
                'item-key': ['required', 'bound', 'non-empty'],
            },
        },
    },
];

const uiRuleOrChecks = combineUiRules(
    'Require CardFan content, a preceding comment, valid props, and explicit items and item-key bindings.',
    createComponentRules(structure, {propsScope: 'root'}),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the card-fans UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the card-fans UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
