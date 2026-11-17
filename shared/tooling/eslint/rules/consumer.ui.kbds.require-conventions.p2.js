import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Kbd: {flags: ['required', 'single-liner', 'non-empty', 'blank-line-after-if-next-sibling']}},
];

export const groupStructure = [
    {
        KbdGroup: {
            flags: ['required'],
            children: [
                {Kbd: {flags: ['required', 'repeatable']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(groupStructure, {propsScope: 'root'}),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the kbds UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the kbds UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
