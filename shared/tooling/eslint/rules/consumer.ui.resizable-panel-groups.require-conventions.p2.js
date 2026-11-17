import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        ResizablePanelGroup: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {Comment: {flags: ['required']}},
                {ResizablePanel: {flags: ['required', 'non-empty']}},
                {
                    Group: {
                        flags: ['required', 'repeatable'],
                        children: [
                            {Comment: {flags: ['required', 'text:Handle']}},
                            {ResizableHandle: {flags: ['required', 'single-liner']}},
                            {ResizablePanel: {flags: ['required', 'non-empty']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the resizable-panel-groups UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the resizable-panel-groups UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
