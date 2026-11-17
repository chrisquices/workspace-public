import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

export const structure = [
    {
        Breadcrumb: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {Icon: {flags: ['optional']}},
                {
                    Group: {
                        flags: ['required', 'one-of'],
                        children: [
                            {
                                BreadcrumbList: {
                                    flags: ['required'],
                                    children: [
                                        {
                                            Group: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {Comment: {flags: ['required']}},
                                                    {
                                                        BreadcrumbItem: {
                                                            flags: ['required', 'multi-liner'],
                                                            children: [
                                                                {
                                                                    Group: {
                                                                        flags: ['required', 'one-of'],
                                                                        children: [
                                                                            {BreadcrumbLink: {flags: ['required', 'comment-source', 'single-liner']}},
                                                                            {BreadcrumbEllipsis: {flags: ['required', 'single-liner']}},
                                                                        ],
                                                                    },
                                                                },
                                                            ],
                                                        },
                                                    },
                                                    {Comment: {flags: ['required', 'text:Separator']}},
                                                    {BreadcrumbSeparator: {flags: ['required', 'single-liner']}},
                                                ],
                                            },
                                        },
                                        {
                                            template: {
                                                flags: ['optional', 'repeatable'],
                                                children: [
                                                    {
                                                        Group: {
                                                            flags: ['optional', 'repeatable'],
                                                            children: [
                                                                {Comment: {flags: ['required']}},
                                                                {
                                                                    BreadcrumbItem: {
                                                                        flags: ['required', 'multi-liner'],
                                                                        children: [
                                                                            {
                                                                                Group: {
                                                                                    flags: ['required', 'one-of'],
                                                                                    children: [
                                                                                        {BreadcrumbLink: {flags: ['required', 'comment-source', 'single-liner']}},
                                                                                        {BreadcrumbEllipsis: {flags: ['required', 'single-liner']}},
                                                                                    ],
                                                                                },
                                                                            },
                                                                        ],
                                                                    },
                                                                },
                                                                {Comment: {flags: ['required', 'text:Separator']}},
                                                                {BreadcrumbSeparator: {flags: ['required', 'single-liner']}},
                                                            ],
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                        {Comment: {flags: ['required']}},
                                        {
                                            BreadcrumbItem: {
                                                flags: ['required'],
                                                children: [
                                                    {BreadcrumbPage: {flags: ['required', 'comment-source', 'single-liner']}},
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                            {BreadcrumbResponsive: {flags: ['required']}},
                        ],
                    },
                },
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure, {
    allowAdditionalParent(node) {
        if (!matchesVueComponentName(node, 'BreadcrumbLink')) return false;

        for (let ancestor = node.parent; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
            const slot = ancestor.startTag.attributes.find((attribute) => attribute.directive && attribute.key.name.name === 'slot');
            if (!slot) continue;

            const owner = ancestor.rawName === 'template' ? ancestor.parent : ancestor;
            return slot.key.argument?.type === 'VIdentifier' && slot.key.argument.name === 'trailing'
                && matchesVueComponentName(owner, 'BreadcrumbResponsive');
        }

        return false;
    },
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the breadcrumbs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the breadcrumbs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
