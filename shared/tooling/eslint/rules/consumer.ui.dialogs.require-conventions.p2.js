import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

function dialogObjectName(node, fallbackToProcessing = false) {
    const attributes = node.startTag.attributes;
    const binding = (function (name) { return (attributes.find((function (attribute) { return (attribute.directive
        && attribute.key.name.name === 'bind' && attribute.key.argument?.type === 'VIdentifier'
        && attribute.key.argument.rawName === name); }))); });
    const attribute = binding('open') ?? binding('dismissible') ?? (fallbackToProcessing ? binding('processing') : undefined);
    let expression = attribute?.value?.expression;

    while (expression && ['UnaryExpression', 'ChainExpression', 'TSAsExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(expression.type)) {
        expression = expression.type === 'UnaryExpression' ? (expression.operator === '!' ? expression.argument : undefined) : expression.expression;
    }

    if (expression?.type !== 'MemberExpression' || expression.computed || expression.object.type !== 'Identifier') {
        return undefined;
    }

    return expression.object.name;
}

function splitName(name) {
    return name.replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/[_$]+/g, ' ').trim();
}

export const structure = [
    {Comment: {flags: ['required']}},
    {
        Dialog: {
            flags: ['required', 'top-level', 'last-in-template', 'multi-liner-attributes', 'blank-line-after-if-next-sibling'],
            attributes: {
                dismissible: ['required-if-bound:open', 'bound'],
                processing: ['required-if-bound:open', 'bound'],
                '@update:open': ['required-if-bound:open'],
            },
            children: [
                {DialogTrigger: {flags: ['forbidden']}},
                {
                    Group: {
                        flags: ['required', 'one-of'],
                        children: [
                            {
                                DialogContent: {
                                    flags: ['required'],
                                    children: [
                                        {
                                            DialogHeader: {
                                                flags: ['required'],
                                                children: [
                                                    {DialogTitle: {flags: ['required', 'comment-source', 'single-liner', 'non-empty']}},
                                                    {DialogDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {BlankLine: {flags: ['required']}},
                                        {Form: {flags: ['optional', 'non-empty']}},
                                        {div: {flags: ['optional', 'repeatable']}},
                                        {BlankLine: {flags: ['required']}},
                                        {
                                            DialogFooter: {
                                                flags: ['optional', 'unordered'],
                                                children: [
                                                    {Comment: {flags: ['required']}},
                                                    {DialogClose: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty'], attributes: {'as-child': ['required-if-descendant:Button']}}},
                                                    {Button: {flags: ['optional', 'repeatable']}},
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                            {
                                DialogScrollContent: {
                                    flags: ['required'],
                                    children: [
                                        {
                                            DialogHeader: {
                                                flags: ['required'],
                                                children: [
                                                    {DialogTitle: {flags: ['required', 'comment-source', 'single-liner', 'non-empty']}},
                                                    {DialogDescription: {flags: ['optional', 'comment-source', 'single-liner', 'non-empty']}},
                                                ],
                                            },
                                        },
                                        {BlankLine: {flags: ['required']}},
                                        {Form: {flags: ['optional', 'non-empty']}},
                                        {div: {flags: ['optional', 'repeatable']}},
                                        {BlankLine: {flags: ['required']}},
                                        {
                                            DialogFooter: {
                                                flags: ['optional', 'unordered'],
                                                children: [
                                                    {Comment: {flags: ['required']}},
                                                    {DialogClose: {flags: ['optional', 'repeatable', 'comment-source', 'non-empty'], attributes: {'as-child': ['required-if-descendant:Button']}}},
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
            ],
        },
    },
];

const componentRules = createComponentRules(structure, {
    propsScope: 'family',
    commentPolicy(instance) {
        if (instance.entry.name !== 'Dialog') {
            return undefined;
        }

        const objectName = dialogObjectName(instance.node);
        const words = objectName && splitName(objectName);
        if (!words) return {suffix: 'Dialog'};
        const name = words.split(/\s+/).map((function (word) { return (word[0].toUpperCase() + word.slice(1)); })).join(' ');
        return {expected: /(?:^| )Dialog$/i.test(name) ? name.replace(/dialog$/i, 'Dialog') : `${name} Dialog`, suffix: 'Dialog'};
    },
    forbiddenMessage: 'Do not use <{{ element }}>. Control <{{ root }}> with v-model:open or :open and @update:open; keep the opener outside <{{ root }}> and preserve its behavior.',
});

const uiRuleOrChecks = combineUiRules('Require Dialog structure, family props, attributes, comments, placement, spacing, layout, and form ID conventions.', {
    ...componentRules,
    'require-dialog-form-id': {
        meta: {
            type: 'problem',
            docs: {description: 'Require Dialog form IDs to match the controlling object name.'},
            fixable: 'code',
            schema: [],
            messages: {id: 'Set this <Form> ID to "{{ expected }}" and update any submit buttons that reference it.'},
        },
        create(context) {
            const services = context.sourceCode.parserServices;

            if (!services.defineTemplateBodyVisitor) {
                return {};
            }

            return services.defineTemplateBodyVisitor({
                VElement(node) {
                    if (!matchesVueComponentName(node, 'Form')) {
                        return;
                    }

                    let dialog = node.parent;
                    while (dialog?.type === 'VElement' && !matchesVueComponentName(dialog, 'Dialog')) dialog = dialog.parent;

                    if (!matchesVueComponentName(dialog, 'Dialog')) {
                        return;
                    }

                    const objectName = dialogObjectName(dialog, true);
                    if (!objectName) return;
                    const words = splitName(objectName);
                    if (!words) return;
                    const expected = `${words.toLowerCase().replace(/\s+/g, '-')}-form`;
                    const id = node.startTag.attributes.find((function (attribute) { return (!attribute.directive && attribute.key.name === 'id'); }));

                    if (id?.value?.value === expected) {
                        return;
                    }

                    context.report({
                        node: node.startTag,
                        messageId: 'id',
                        data: {expected: expected},
                        fix(fixer) {
                            const elements = [context.sourceCode.ast.templateBody].filter(Boolean);
                            for (const element of elements) elements.push(...element.children.filter((function (child) { return (child.type === 'VElement'); })));
                            const oldId = id?.value?.value;
                            const uncertain = node.startTag.attributes.some((function (attribute) { return (attribute.directive
                                && attribute.key.name.name === 'bind'
                                && (!attribute.key.argument || attribute.key.argument.type !== 'VIdentifier' || attribute.key.argument.rawName === 'id')); }));

                            if (uncertain || (id && !oldId)) {
                                return null;
                            }

                            if (elements.some((function (element) { return (element !== node && element.startTag.attributes.some((function (attribute) { return ((
                                !attribute.directive && attribute.key.name === 'id'
                                && (attribute.value?.value === expected || (oldId && attribute.value?.value === oldId))
                            )); }))); }))) return null;

                            if (oldId && elements.some((function (element) { return (element.startTag.attributes.some((function (attribute) { return (attribute.directive
                                && attribute.key.name.name === 'bind' && (!attribute.key.argument
                                    || attribute.key.argument.type !== 'VIdentifier' || attribute.key.argument.rawName === 'form')); }))); }))) return null;

                            const fixes = [id
                                ? fixer.replaceText(id, `id="${expected}"`)
                                : fixer.insertTextAfterRange([node.startTag.range[0], node.startTag.range[0] + node.rawName.length + 1], ` id="${expected}"`)];

                            if (oldId) {
                                for (const element of elements) {
                                    for (const attribute of element.startTag.attributes) {
                                        if (!attribute.directive && attribute.key.name === 'form' && attribute.value?.value === oldId) {
                                            fixes.push(fixer.replaceText(attribute, `form="${expected}"`));
                                        }
                                    }
                                }
                            }

                            return fixes;
                        },
                    });
                },
            });
        },
    },
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the dialogs UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the dialogs UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
