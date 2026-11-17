import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Tooltip: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {TooltipTrigger: {flags: ['required', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {TooltipContent: {flags: ['required', 'comment-source', 'non-empty']}},
            ],
        },
    },
];

export const providerStructure = [
    {TooltipProvider: {flags: ['required', 'non-empty', 'once-per-file']}},
];

// Both generated check sets share one message catalog in the combined rule.
const oncePerFileMessage = 'Use <{{ element }}> only once per file. Multiple providers create separate tooltip contexts. Consolidate them into one provider, ideally in a top-level shell or layout.';

const uiRuleOrChecks = combineUiRules(
    'Require Tooltip structure, props, comments, and spacing conventions, and at most one TooltipProvider per file.',
    {
        ...createComponentRules(structure, {oncePerFileMessage}),
        ...createComponentRules(providerStructure, {oncePerFileMessage}),
    },
);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the tooltips UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the tooltips UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
