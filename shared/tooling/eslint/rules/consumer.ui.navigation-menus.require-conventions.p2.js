import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        NavigationMenu: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    NavigationMenuList: {
                        flags: ['required'],
                        children: [
                            {NavigationMenuItem: {flags: ['required', 'repeatable', 'non-empty']}},
                            {NavigationMenuIndicator: {flags: ['optional', 'single-liner']}},
                        ],
                    },
                },
                {NavigationMenuViewport: {flags: ['optional', 'single-liner']}},
            ],
        },
    },
];

export const itemStructure = [
    {
        NavigationMenuItem: {
            flags: ['required', 'non-empty'],
            children: [
                {NavigationMenuTrigger: {flags: ['optional', 'comment-source', 'non-empty']}},
                {NavigationMenuLink: {flags: ['optional', 'comment-source', 'non-empty']}},
                {NavigationMenuContent: {flags: ['optional', 'non-empty']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    ...createComponentRules(itemStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the navigation-menus UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the navigation-menus UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
