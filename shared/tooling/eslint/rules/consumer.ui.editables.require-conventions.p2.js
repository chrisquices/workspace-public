import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Editable: {
            flags: ['required', 'blank-line-between-children', 'blank-line-after-if-next-sibling'],
            children: [
                {
                    EditableArea: {
                        flags: ['required'],
                        children: [
                            {EditablePreview: {flags: ['required']}},
                            {EditableInput: {flags: ['required', 'single-liner']}},
                        ],
                    },
                },
                {EditableEditTrigger: {flags: ['optional', 'comment-source']}},
                {EditableSubmitTrigger: {flags: ['optional']}},
                {EditableCancelTrigger: {flags: ['optional']}},
            ],
        },
    },
];

const uiRuleOrChecks = createComponentRules(structure);

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the editables UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the editables UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
