import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Sheet: {
            flags: ['required', 'top-level', 'last-in-template', 'blank-line-after-if-next-sibling'],
            children: [
                {SheetTrigger: {flags: ['forbidden']}},
                {SheetOverlay: {flags: ['optional', 'single-liner']}},
                {
                    SheetContent: {
                        flags: ['required'],
                        children: [
                            {
                                SheetHeader: {
                                    flags: ['required'],
                                    children: [
                                        {SheetTitle: {flags: ['required', 'comment-source', 'single-liner', 'non-empty']}},
                                        {SheetDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                    ],
                                },
                            },
                            {BlankLine: {flags: ['required']}},
                            {Form: {flags: ['optional', 'non-empty']}},
                            {div: {flags: ['optional', 'repeatable']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                SheetFooter: {
                                    flags: ['optional', 'unordered'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {SheetClose: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
                                        {Button: {flags: ['optional', 'repeatable']}},
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure, {
    propsScope: 'family',
    forbiddenMessage: 'Do not use <{{ element }}>. Control <{{ root }}> with v-model:open or :open and @update:open; keep the opener outside <{{ root }}> and preserve its behavior.',
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the sheets UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the sheets UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
