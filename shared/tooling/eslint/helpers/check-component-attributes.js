import { getVueAttributeBindings } from '#eslint/helpers/get-vue-attribute-bindings.js';
import { getStaticTemplateValue, unknownTemplateValue } from '#eslint/helpers/get-static-template-value.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { walkComponentStructure } from '#eslint/helpers/walk-component-structure.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';

const camelize = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// Compare syntax and template scope, not spelling alone: two loop variables can share a name.
function sameBinding(sourceCode, left, right) {
    if (!left || !right) return false;
    if (left.value !== unknownTemplateValue || right.value !== unknownTemplateValue) {
        return left.value !== unknownTemplateValue && right.value !== unknownTemplateValue && left.value === right.value;
    }
    if (!left.expression || !right.expression) return false;
    let stable = true;
    function shape(expression) {
        const node = unwrapExpression(expression);
        if (!node) return null;
        if (['CallExpression', 'NewExpression', 'AssignmentExpression', 'UpdateExpression', 'AwaitExpression', 'YieldExpression'].includes(node.type)) stable = false;
        if (node.type === 'Identifier') return [node.type, node.name];
        if (node.type === 'Literal') return [node.regex ? 'RegExp' : node.bigint !== undefined ? 'BigInt' : node.type, node.regex ?? node.bigint ?? node.value];
        if (node.type === 'TemplateLiteral' && !node.expressions.length) return ['Literal', node.quasis[0].value.cooked];
        if (node.type === 'TemplateElement') return [node.type, node.value.cooked ?? node.value.raw];
        const flags = ['operator', 'computed', 'optional', 'kind', 'method', 'shorthand', 'async', 'generator', 'delegate', 'prefix']
            .filter((key) => node[key] !== undefined).map((key) => [key, node[key]]);
        const children = (sourceCode.visitorKeys[node.type] ?? [])
            .filter((key) => !['typeArguments', 'typeParameters', 'typeAnnotation', 'returnType'].includes(key))
            .map((key) => [key, Array.isArray(node[key]) ? node[key].map(shape) : shape(node[key])]);
        return [node.type, flags, children];
    }
    const equal = JSON.stringify(shape(left.expression)) === JSON.stringify(shape(right.expression));
    const locals = (binding) => new Map(binding.references.filter((reference) => reference.variable)
        .map((reference) => [reference.id.name, reference.variable]));
    const leftLocals = locals(left);
    const rightLocals = locals(right);
    return stable && equal && leftLocals.size === rightLocals.size
        && [...leftLocals].every(([name, variable]) => rightLocals.get(name) === variable);
}

// Required declarations describe authored attributes, including explicit event listeners.
function declaredAttribute(node, name, boundOnly = false) {
    const event = name.startsWith('@');
    const target = camelize(event ? name.slice(1) : name);
    return node.startTag.attributes.findLast((attribute) => {
        if (!attribute.directive) return !event && !boundOnly && camelize(attribute.key.rawName) === target;
        if (attribute.key.name.name !== (event ? 'on' : 'bind')) return false;
        const argument = attribute.key.argument;
        const actual = argument?.type === 'VIdentifier' ? argument.rawName
            : getStaticTemplateValue(argument?.expression, new Set());
        return typeof actual === 'string' && camelize(actual) === target;
    });
}

function containsComponent(node, name, owner = node.rawName) {
    return node.children.some((child) => {
        if (child.type !== 'VElement') return false;
        if (matchesVueComponentName(child, name)) return true;
        // Nested surfaces and nested close/cancel controls own their composition.
        if (['Dialog', 'AlertDialog', 'Sheet', 'Drawer', owner].some((boundary) => matchesVueComponentName(child, boundary))) return false;
        return containsComponent(child, name, owner);
    });
}

export function checkComponentAttributes(context, instance) {
    if (!instance.entry.attributes.length) return;
    const bindings = getVueAttributeBindings(context.sourceCode, instance.node);
    if (!bindings) return;
    for (const constraint of instance.entry.attributes) {
        const conditional = constraint.requiredIfBound.length || constraint.requiredIfDescendant.length;
        const required = constraint.required
            || constraint.requiredIfBound.some((name) => declaredAttribute(instance.node, name, true))
            || constraint.requiredIfDescendant.some((name) => containsComponent(instance.node, name));
        if (conditional && !required) continue;
        const authored = declaredAttribute(instance.node, constraint.name);
        const attribute = constraint.name.startsWith('@')
            ? authored && {node: authored, value: unknownTemplateValue}
            : bindings.attributes.get(camelize(constraint.name));
        const data = {element: instance.node.rawName, attribute: constraint.name};
        const report = (messageId, extra = {}) => context.report({
            node: authored ?? attribute?.node ?? instance.node.startTag, messageId, data: {...data, ...extra},
        });
        if (required && !authored) {
            report('attributeRequired');
            continue;
        }
        if (constraint.bound && authored && !declaredAttribute(instance.node, constraint.name, true)) {
            report('attributeBound');
            continue;
        }
        if (!attribute && !bindings.uncertain) continue;
        if (constraint.nonEmpty && attribute && (attribute.value == null || (typeof attribute.value === 'string' && !attribute.value.trim()))) {
            report('attributeEmpty');
            continue;
        }
        if (constraint.value !== undefined && attribute?.value !== constraint.value) {
            report('attributeValue', {expected: JSON.stringify(constraint.value),
                actual: !attribute || attribute.value === unknownTemplateValue ? 'an unverified binding'
                    : (JSON.stringify(attribute.value, (_, value) => typeof value === 'bigint' ? `${value}n` : value) ?? String(attribute.value)).slice(0, 160)});
        }
        if (!constraint.match) continue;
        const target = constraint.match;
        const group = instance.groups.get(target.scopePath);
        let scope = instance;
        if (target.group) {
            while (scope.parent && scope.groups.get(target.scopePath) === group) scope = scope.parent;
        } else {
            while (scope.parent && scope.entry.path !== target.scopePath) scope = scope.parent;
        }
        const candidates = [...walkComponentStructure(scope)].filter((candidate) => target.paths.has(candidate.entry.path)
            && (!target.group || candidate.groups.get(target.scopePath) === group));
        const match = candidates.length === 1 ? getVueAttributeBindings(context.sourceCode, candidates[0].node)?.attributes.get(camelize(target.attribute)) : undefined;
        if (sameBinding(context.sourceCode, attribute, match)) continue;
        report('attributeMismatch', {target: target.name, targetAttribute: target.attribute,
            scope: target.group ? `Group occurrence inside <${scope.node.rawName}>` : `<${scope.node.rawName}>`});
    }
}
