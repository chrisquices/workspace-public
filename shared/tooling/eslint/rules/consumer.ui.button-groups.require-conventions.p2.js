import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {BlankLine: {flags: ['required']}},
    {
        ButtonGroup: {
            flags: ['required', 'non-empty', 'unordered', 'single-liner-attributes', 'blank-line-after-if-next-sibling'],
            children: [
                {Button: {flags: ['optional', 'repeatable']}},
                {Comment: {flags: ['required']}},
                {ButtonGroupText: {flags: ['optional', 'repeatable', 'single-liner', 'non-empty', 'comment-source']}},
                {Comment: {flags: ['required', 'text:Separator']}},
                {ButtonGroupSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
                {Input: {flags: ['optional', 'repeatable']}},
                {Select: {flags: ['optional', 'repeatable']}},
                {DropdownMenu: {flags: ['optional', 'repeatable']}},
                {ButtonGroup: {flags: ['optional', 'repeatable']}},
            ],
        },
    },
];

const uiRuleOrChecks = combineUiRules(
    'Require ButtonGroup family structure, props, comments, spacing, and layout conventions.',
    createComponentRules(structure, {propsScope: 'family'}),
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the button-groups UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the button-groups UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
