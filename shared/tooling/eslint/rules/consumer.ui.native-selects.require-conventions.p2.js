import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        NativeSelect: {
            flags: ['required', 'unordered', 'non-empty', 'blank-line-after-if-next-sibling'],
            children: [
                {NativeSelectOption: {flags: ['optional', 'repeatable', 'single-liner']}},
                {
                    NativeSelectOptGroup: {
                        flags: ['optional', 'repeatable'],
                        children: [
                            {NativeSelectOption: {flags: ['required', 'repeatable', 'single-liner']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the native-selects UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the native-selects UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
