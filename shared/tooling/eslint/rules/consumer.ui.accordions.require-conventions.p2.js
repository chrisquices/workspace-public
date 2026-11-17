import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Accordion: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    AccordionItem: {
                        flags: ['required', 'repeatable'],
                        children: [
                            {AccordionTrigger: {flags: ['required', 'comment-source', 'single-liner']}},
                            {BlankLine: {flags: ['required']}},
                            {AccordionContent: {flags: ['required']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the accordions UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the accordions UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
