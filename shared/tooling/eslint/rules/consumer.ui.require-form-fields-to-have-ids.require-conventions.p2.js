import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import {unwrapExpression as unwrapScriptExpression} from '#eslint/helpers/unwrap-expression.js';

const controls = ['Input', 'InputGroupInput', 'InputGroupTextarea', 'Textarea', 'Checkbox', 'Switch', 'Select', 'Combobox', 'DatePicker', 'NumberField', 'Slider', 'InputOTP', 'TagsInput'];

function staticAttribute(node, name) {
    return node.startTag.attributes.find((function (attribute) { return (!attribute.directive && attribute.key.name === name); }));
}

function hasDynamicAttribute(node, name) {
    return node.startTag.attributes.some((function (attribute) { return (attribute.directive && attribute.key.name.name === 'bind'
        && (!attribute.key.argument || attribute.key.argument.type !== 'VIdentifier' || attribute.key.argument.rawName === name)); }));
}

function fieldElements(field) {
    const nodes = [];
    const pending = field.children.filter((function (child) { return (child.type === 'VElement'); }));
    while (pending.length) {
        const node = pending.shift();

        if (matchesVueComponentName(node, 'Field') || matchesVueComponentName(node, 'Form')) {
            continue;
        }

        nodes.push(node);
        pending.push(...node.children.filter((function (child) { return (child.type === 'VElement'); })));
    }
    return nodes;
}

function modelName(node) {
    const models = node.startTag.attributes.filter((function (attribute) { return (attribute.directive && attribute.key.name.name === 'model'
        && (!attribute.key.argument || (attribute.key.argument.type === 'VIdentifier' && attribute.key.argument.name === 'modelValue'))); }));
    if (models.length !== 1) return undefined;
    const expression = unwrapScriptExpression(models[0].value?.expression);

    if (expression?.type === 'Identifier') {
        return expression.name;
    }

    if (expression?.type !== 'MemberExpression') {
        return undefined;
    }

    if (!expression.computed && expression.property.type === 'Identifier') {
        return expression.property.name;
    }

    if (expression.computed && expression.property.type === 'Literal' && typeof expression.property.value === 'string') {
        return expression.property.value;
    }

    return undefined;
}

function kebab(name) {
    return name.replace(/([a-z\d])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/[_\s]+/g, '-').toLowerCase();
}

const uiRuleOrChecks = {
    meta: {
        type: 'problem',
        docs: {description: 'Derive field control IDs and label associations from the form ID and model property.'},
        fixable: 'code',
        schema: [],
        messages: {
            ambiguous: 'Cannot determine the form field ID safely. Use a static Form ID and one unambiguous modelled input and associated FieldLabel.',
            mismatch: 'Use "{{ expected }}" for the input ID and associated FieldLabel for. Preserve other references to the ID.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        if (!services.defineTemplateBodyVisitor) return {};

        return services.defineTemplateBodyVisitor({
            VElement(field) {
                if (!matchesVueComponentName(field, 'Field')) {
                    return;
                }

                let form = field.parent;
                while (form?.type === 'VElement' && !matchesVueComponentName(form, 'Form')) form = form.parent;
                if (!matchesVueComponentName(form, 'Form')) return;

                const elements = fieldElements(field);
                const inputs = elements.filter((function (node) { return (controls.some((function (name) { return (matchesVueComponentName(node, name)); }))); }));
                if (!inputs.length) return;
                const labels = elements.filter((function (node) { return (matchesVueComponentName(node, 'FieldLabel')); }));
                const formId = staticAttribute(form, 'id')?.value?.value;
                const name = inputs.length === 1 ? modelName(inputs[0]) : undefined;

                if (!formId || hasDynamicAttribute(form, 'id') || !name || !/^[\w$]+$/u.test(name) || labels.length > 1) {
                    context.report({node: field.startTag, messageId: 'ambiguous'});
                    return;
                }

                const expected = `${formId}-${kebab(name)}`;
                const input = inputs[0];
                const label = labels[0];
                const id = staticAttribute(input, 'id');
                const labelFor = label && staticAttribute(label, 'for');

                if (id?.value?.value === expected && (!label || labelFor?.value?.value === expected)
                    && !hasDynamicAttribute(input, 'id') && (!label || !hasDynamicAttribute(label, 'for'))) return;

                context.report({
                    node: input.startTag,
                    messageId: 'mismatch',
                    data: {expected: expected},
                    fix(fixer) {
                        if (hasDynamicAttribute(input, 'id') || (label && hasDynamicAttribute(label, 'for'))) {
                            return null;
                        }

                        for (let parent = field; parent?.type === 'VElement'; parent = parent.parent) {
                            if (parent.startTag.attributes.some((function (attribute) { return (attribute.directive && attribute.key.name.name === 'for'); }))) {
                                return null;
                            }
                        }
                        const oldId = id?.value?.value;

                        if (labelFor?.value?.value && labelFor.value.value !== oldId && labelFor.value.value !== expected) {
                            return null;
                        }

                        const all = [sourceCode.ast.templateBody].filter(Boolean);
                        for (const element of all) all.push(...element.children.filter((function (child) { return (child.type === 'VElement'); })));

                        if (all.some((function (element) { return (element !== input && staticAttribute(element, 'id')?.value?.value === expected); }))) {
                            return null;
                        }

                        if (oldId && all.some((function (element) { return (element !== input && element.startTag.attributes.some((function (attribute) { return ((
                            !attribute.directive && attribute.value?.value === oldId && !(element === label && attribute === labelFor)
                        )); }))); }))) return null;

                        const set = (function (node, attribute, key) { return (attribute
                            ? fixer.replaceText(attribute, `${key}="${expected}"`)
                            : fixer.insertTextAfterRange([node.startTag.range[0], node.startTag.range[0] + node.rawName.length + 1], ` ${key}="${expected}"`)); });
                        const fixes = [];

                        if (id?.value?.value !== expected) {
                            fixes.push(set(input, id, 'id'));
                        }

                        if (label && labelFor?.value?.value !== expected) {
                            fixes.push(set(label, labelFor, 'for'));
                        }

                        return fixes;
                    },
                });
            },
        });
    },
};

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the require-form-fields-to-have-ids UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the require-form-fields-to-have-ids UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
