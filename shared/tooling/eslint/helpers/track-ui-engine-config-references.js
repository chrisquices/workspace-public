import { unwrapExpression } from './unwrap-expression.js';
import { getStaticPropertyName } from './get-static-property-name.js';
import { resolveVariableBinding } from './resolve-variable-binding.js';

export function trackUiEngineConfigReferences(context, engine) {
    const source = context.sourceCode;
    const config = source.getScope(engine).set.get('config');
    const paths = new Map();
    const nodes = [];
    if (config) paths.set(config, []);

    function getPath(expression) {
        expression = unwrapExpression(expression);
        if (expression?.type === 'Identifier') return paths.get(resolveVariableBinding(expression, source)) ?? null;
        if (expression?.type !== 'MemberExpression') return null;
        const parent = getPath(expression.object);
        const key = getStaticPropertyName(expression);
        return parent && typeof key === 'string' ? [...parent, key] : null;
    }

    function collect(node) {
        nodes.push(node);
        for (const key of source.visitorKeys[node.type] ?? []) {
            const children = node[key];
            if (Array.isArray(children)) {
                for (const child of children) if (child?.type) collect(child);
            } else if (children?.type) collect(children);
        }
    }

    function assign(pattern, path) {
        if (pattern.type === 'AssignmentPattern') return assign(pattern.left, path);
        if (pattern.type === 'Identifier') {
            const variable = resolveVariableBinding(pattern, source);
            if (!variable || paths.has(variable)) return false;
            paths.set(variable, path);
            return true;
        }
        if (pattern.type !== 'ObjectPattern') return false;
        let changed = false;
        for (const property of pattern.properties) {
            if (property.type !== 'Property') continue;
            const key = getStaticPropertyName(property);
            if (typeof key === 'string') changed = assign(property.value, [...path, key]) || changed;
        }
        return changed;
    }

    collect(engine.body);
    let changed;
    do {
        changed = false;
        for (const node of nodes) {
            const target = node.type === 'VariableDeclarator' ? node.id
                : node.type === 'AssignmentExpression' && node.operator === '=' ? node.left : null;
            if (!target) continue;
            const path = getPath(node.type === 'VariableDeclarator' ? node.init : node.right);
            if (path) changed = assign(target, path) || changed;
        }
    } while (changed);

    return {getPath, nodes, paths};
}
