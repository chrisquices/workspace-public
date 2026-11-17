import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Attachment: {
            flags: ['required', 'blank-line-after-if-next-sibling'],
            children: [
                {AttachmentTrigger: {flags: ['optional']}},
                {AttachmentMedia: {flags: ['optional']}},
                {BlankLine: {flags: ['required']}},
                {
                    AttachmentContent: {
                        flags: ['required'],
                        children: [
                            {AttachmentTitle: {flags: ['required', 'comment-source', 'single-liner']}},
                            {AttachmentDescription: {flags: ['optional', 'comment-source', 'single-liner']}},
                        ],
                    },
                },
                {BlankLine: {flags: ['required']}},
                {
                    AttachmentActions: {
                        flags: ['optional'],
                        children: [
                            {Comment: {flags: ['required']}},
                            {AttachmentAction: {flags: ['required', 'repeatable', 'comment-source']}},
                        ],
                    },
                },
            ],
        },
    },
];

export const groupStructure = [
    {
        AttachmentGroup: {
            flags: ['required'],
            children: [
                {Attachment: {flags: ['required', 'repeatable']}},
            ],
        },
    },
];

// The group checks membership; each Attachment's own rules check its props and contents.
const groupRules = createComponentRules(groupStructure);

const uiRuleOrChecks = {
    ...createComponentRules(structure),
    'require-attachmentgroup-structure': groupRules['require-attachmentgroup-structure'],
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the attachments UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the attachments UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
