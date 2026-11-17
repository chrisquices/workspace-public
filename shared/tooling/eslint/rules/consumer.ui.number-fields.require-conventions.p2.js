import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        NumberField: {
            flags: ['required', 'multi-liner-attributes', 'blank-line-after-if-next-sibling'],
            children: [
                {Label: {flags: ['optional']}},
                {
                    NumberFieldContent: {
                        flags: ['required'],
                        children: [
                            {NumberFieldDecrement: {flags: ['optional', 'single-liner']}},
                            {NumberFieldInput: {flags: ['required', 'single-liner']}},
                            {NumberFieldIncrement: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure, {propsScope: 'family'});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the number-fields UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the number-fields UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
