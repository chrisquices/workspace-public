import { getStaticTemplateValue } from '#eslint/helpers/get-static-template-value.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const bindings = new WeakMap();
const camelize = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

export function getVueAttributeBindings(sourceCode, node) {
    for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
        if (ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return null;
    }
    if (bindings.has(node)) return bindings.get(node);
    const attributes = new Map();
    let uncertain = false;
    // Template references identify v-for/slot bindings; module scopes identify script bindings.
    const shadowsUndefined = sourceCode.scopeManager.scopes.some((scope) => (
        ['global', 'module'].includes(scope.type) && scope.set.get('undefined')?.defs.length
    ));
    const undefinedReferences = new Set(shadowsUndefined ? [] : node.startTag.attributes
        .flatMap((attribute) => attribute.value?.references ?? [])
        .filter((reference) => reference.id.name === 'undefined' && !reference.variable)
        .map((reference) => reference.id));

    function forgetBindings() {
        // Unknown spreads/computed keys can supply required props or replace earlier values.
        attributes.clear();
        uncertain = true;
    }

    function boundValue(expression, attribute, reportNode = attribute) {
        return {
            value: getStaticTemplateValue(expression, undefinedReferences), node: reportNode, expression,
            references: (attribute.value?.references ?? []).filter((reference) => expression?.range
                && reference.id.range[0] >= expression.range[0] && reference.id.range[1] <= expression.range[1]),
        };
    }

    function bindObject(expression, attribute) {
        expression = unwrapExpression(expression);
        if (expression?.type !== 'ObjectExpression') {
            const value = getStaticTemplateValue(expression, undefinedReferences);
            if (value !== null && value !== undefined) forgetBindings();
            return;
        }
        for (const property of expression.properties) {
            if (property.type === 'SpreadElement') {
                bindObject(property.argument, attribute);
                continue;
            }
            const name = !property.computed && property.key.type === 'Identifier' ? property.key.name : getStaticTemplateValue(property.key, undefinedReferences);
            if (typeof name !== 'string') forgetBindings();
            else attributes.set(camelize(name), boundValue(property.kind === 'init' ? property.value : null, attribute, property));
        }
    }

    for (const attribute of node.startTag.attributes) {
        if (!attribute.directive) {
            attributes.set(camelize(attribute.key.rawName), {value: attribute.value?.value ?? '', node: attribute});
            continue;
        }
        const directive = attribute.key.name.name;
        if (!['bind', 'model'].includes(directive)) continue;
        const argument = attribute.key.argument;
        if (!argument && directive === 'bind') {
            bindObject(attribute.value?.expression, attribute);
            continue;
        }
        const name = !argument ? 'modelValue' : argument.type === 'VIdentifier' ? argument.rawName : getStaticTemplateValue(argument.expression, undefinedReferences);
        if (typeof name !== 'string') forgetBindings();
        else attributes.set(camelize(name), boundValue(attribute.value?.expression, attribute));
    }

    const result = {attributes, uncertain};
    bindings.set(node, result);
    return result;
}
