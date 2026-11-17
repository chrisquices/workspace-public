import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Link: {
        flags: ['required', 'single-liner-attributes', 'blank-line-after-if-next-sibling'],
        attributes: {
            href: ['required', 'non-empty'],
        },
    }},
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the links UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the links UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
