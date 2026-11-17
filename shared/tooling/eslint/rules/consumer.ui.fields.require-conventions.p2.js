import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Field: {
            flags: ['required', 'unordered', 'non-empty', 'blank-line-after-if-next-sibling'],
            attributes: {'data-invalid': ['required', 'bound']},
            children: [
                {FieldLabel: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty'], attributes: {for: ['required', 'non-empty']}}},
                {FieldTitle: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                {Checkbox: {flags: ['optional']}},
                {RadioGroup: {flags: ['optional']}},
                {RadioGroupItem: {flags: ['optional']}},
                {Switch: {flags: ['optional']}},
                {Toggle: {flags: ['optional']}},
                {Button: {flags: ['optional', 'repeatable']}},
                {Select: {flags: ['optional']}},
                {Combobox: {flags: ['optional']}},
                {DatePicker: {flags: ['optional']}},
                {
                    FieldContent: {
                        flags: ['required', 'unordered', 'non-empty'],
                        children: [
                            {FieldLabel: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty'], attributes: {for: ['required', 'non-empty']}}},
                            {FieldTitle: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                            {Input: {flags: ['optional']}},
                            {Textarea: {flags: ['optional']}},
                            {Select: {flags: ['optional']}},
                            {Combobox: {flags: ['optional']}},
                            {DatePicker: {flags: ['optional']}},
                            {Slider: {flags: ['optional']}},
                            {NumberField: {flags: ['optional']}},
                            {InputGroup: {flags: ['optional']}},
                            {InputOTP: {flags: ['optional']}},
                            {TagsInput: {flags: ['optional']}},
                            {FieldDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                            {FieldError: {flags: ['optional'], attributes: {errors: ['required', 'bound']}}},
                            {div: {flags: ['optional', 'repeatable']}},
                        ],
                    },
                },
            ],
        },
    },
];

export const groupStructure = [
    {
        FieldGroup: {
            flags: ['required', 'unordered', 'non-empty'],
            children: [
                {Field: {flags: ['optional', 'repeatable']}},
                {FieldSet: {flags: ['optional', 'repeatable']}},
                {FieldSeparator: {flags: ['optional', 'repeatable', 'single-liner']}},
            ],
        },
    },
];

export const setStructure = [
    {Comment: {flags: ['required']}},
    {
        FieldSet: {
            flags: ['required'],
            children: [
                {FieldLegend: {flags: ['required', 'comment-source', 'single-liner', 'non-empty']}},
                {BlankLine: {flags: ['required']}},
                {FieldGroup: {flags: ['required']}},
            ],
        },
    },
];

const uiRuleOrChecks = {
    ...createComponentRules(structure, {propsScope: 'family'}),
    ...createComponentRules(groupStructure, {propsScope: 'root'}),
    ...createComponentRules(setStructure),
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the fields UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the fields UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
