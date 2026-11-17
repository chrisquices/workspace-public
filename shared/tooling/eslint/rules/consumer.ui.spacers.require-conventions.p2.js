import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

// Spacer is an empty layout component. Require an explicit side; valid values
// come from its component props. Never guess a missing side during autofix.
import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required', 'text:Spacer']}},
    {
        Spacer: {
            flags: ['required', 'self-closing', 'single-liner-attributes'],
            attributes: {
                side: ['required', 'non-empty'],
            },
            children: [],
        },
    },
];

const uiRuleOrChecks = combineUiRules(
    'Require Spacer to have a fixed Spacer comment, an explicit valid side, no child content, and a self-closing tag with single-liner attributes.',
    createComponentRules(structure, {propsScope: 'root'}),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the spacers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the spacers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
