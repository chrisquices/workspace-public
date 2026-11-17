import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Drawer: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {DrawerTrigger: {flags: ['forbidden']}},
                {
                    DrawerContent: {
                        flags: ['required'],
                        children: [
                            {
                                DrawerHeader: {
                                    flags: ['required'],
                                    children: [
                                        {DrawerTitle: {flags: ['required', 'comment-source', 'single-liner', 'non-empty']}},
                                        {DrawerDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                    ],
                                },
                            },
                            {BlankLine: {flags: ['required']}},
                            {Form: {flags: ['optional', 'non-empty']}},
                            {div: {flags: ['optional', 'repeatable']}},
                            {BlankLine: {flags: ['required']}},
                            {
                                DrawerFooter: {
                                    flags: ['optional', 'unordered', 'blank-line-between-children'],
                                    children: [
                                        {Comment: {flags: ['required']}},
                                        {DrawerClose: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty']}},
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

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the drawers UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the drawers UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
