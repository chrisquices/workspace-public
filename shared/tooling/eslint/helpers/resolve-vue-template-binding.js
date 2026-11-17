import { getModuleScope } from './get-module-scope.js';

export function resolveVueTemplateBinding(name, element, sourceCode) {
    for (let current = element; current?.type === 'VElement'; current = current.parent) {
        const variable = current.variables.find(function (entry) {
            return entry.id.name === name && (current !== element || entry.kind !== 'scope');
        });

        if (variable) {
            return variable;
        }
    }

    return getModuleScope(sourceCode).set.get(name) ?? null;
}
