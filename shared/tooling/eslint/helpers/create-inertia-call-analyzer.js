import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { getUnreassignedVariableInitializer } from '#eslint/helpers/get-unreassigned-variable-initializer.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export const inertiaPackages = new Set(['@inertiajs/core', '@inertiajs/vue3', '@inertiajs/react', '@inertiajs/svelte']);

const unknownProperty = { unknown: true };
const absentProperty = { absent: true };

// Router verbs carrying data put request options after that payload. Form verbs
// carry their own data and put options directly after the destination instead.
const routerOptionIndexes = {
    get: 2,
    post: 2,
    put: 2,
    patch: 2,
    query: 2,
    delete: 1,
    visit: 1,
    prefetch: 1,
    reload: 0,
    poll: 1,
};
const formRequestMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'query']);

export function createInertiaCallAnalyzer(sourceCode) {
    const helperDefinitions = new WeakSet();

    function resolve(expression, seen, inspect) {
        const node = unwrapExpression(expression);
        const constant = getUnreassignedVariableInitializer(node, sourceCode);

        if (constant) {
            if (seen.has(constant.variable)) {
                return inspect(undefined, seen);
            }

            return resolve(constant.expression, new Set([...seen, constant.variable]), inspect);
        }

        if (node?.type === 'ConditionalExpression') {
            return resolve(node.test, seen, function (test) {
                return test?.type === 'Literal'
                    ? resolve(test.value ? node.consequent : node.alternate, seen, inspect)
                    : inspect(node, seen);
            });
        }

        if (node?.type === 'LogicalExpression') {
            return resolve(node.left, seen, function (left) {
                if (left?.type !== 'Literal') {
                    return inspect(node, seen);
                }

                const useRight = node.operator === '&&' ? Boolean(left.value)
                    : node.operator === '||' ? !left.value
                    : left.value === null;

                return useRight ? resolve(node.right, seen, inspect) : inspect(left, seen);
            });
        }

        return inspect(node, seen);
    }

    function objectProperty(expression, name, seen = new Set()) {
        return resolve(expression, seen, function (node, visited) {
            if (node?.type === 'ConditionalExpression') {
                return [...objectProperty(node.consequent, name, visited), ...objectProperty(node.alternate, name, visited)];
            }

            if (node?.type === 'LogicalExpression') {
                return [...objectProperty(node.left, name, visited), ...objectProperty(node.right, name, visited)];
            }

            if (node?.type !== 'ObjectExpression') {
                return [unknownProperty];
            }

            let values = [absentProperty];

            for (const property of node.properties) {
                if (property.type === 'SpreadElement') {
                    const spread = objectProperty(property.argument, name, visited);
                    values = values.flatMap(function (previous) {
                        return spread.map(function (next) {
                            return next.absent ? previous : next;
                        });
                    });
                    continue;
                }

                const key = getStaticPropertyName(property);

                if (key === name) {
                    values = property.kind === 'init' ? [{ expression: property.value, seen: visited }] : [unknownProperty];
                } else if (key === null) {
                    values = [unknownProperty];
                }
            }

            return values;
        });
    }

    function isHelperFactory(call) {
        const binding = resolveImportOrigin(call.callee, sourceCode);

        return binding?.source === 'workspace-packages/inertia-helper' && binding.name === 'useInertiaHelperForm';
    }

    function registerForms(calls) {
        for (const call of calls) {
            if (!isHelperFactory(call)) {
                continue;
            }

            for (const value of objectProperty(call.arguments[0], 'form')) {
                resolve(value.expression, value.seen ?? new Set(), function (node) {
                    if (node?.type === 'ObjectExpression') {
                        helperDefinitions.add(node);
                    }
                });
            }
        }
    }

    function hasInheritedMethod(definition, method, seen = new Set()) {
        return objectProperty(definition, method, seen).every(function (value) {
            return value.absent;
        });
    }

    function receiverKind(expression, method, seen = new Set()) {
        const imported = resolveImportOrigin(expression, sourceCode);

        if (inertiaPackages.has(imported?.source) && imported.name === 'router') {
            return 'router';
        }

        return resolve(expression, seen, function (node, visited) {
            if (node?.type === 'ConditionalExpression' || node?.type === 'LogicalExpression') {
                const first = node.consequent ?? node.left;
                const second = node.alternate ?? node.right;
                const kind = receiverKind(first, method, visited);

                return kind && kind === receiverKind(second, method, visited) ? kind : null;
            }

            if (node?.type === 'CallExpression') {
                const factory = resolveImportOrigin(node.callee, sourceCode);

                if (inertiaPackages.has(factory?.source) && factory.name === 'useForm') {
                    return 'form';
                }

                if (isHelperFactory(node) && objectProperty(node.arguments[0], 'form').every(function (value) {
                    return value.expression && hasInheritedMethod(value.expression, method, value.seen);
                })) {
                    return 'form';
                }
            }

            if (node?.type === 'ThisExpression') {
                let scope = sourceCode.getScope(node);

                while (scope && (scope.type !== 'function' || scope.block.type === 'ArrowFunctionExpression')) {
                    if (scope.type === 'class-field-initializer' || scope.type === 'class-static-block') {
                        return null;
                    }

                    scope = scope.upper;
                }

                let owner = scope?.block;

                while (owner?.parent && unwrapExpression(owner.parent) === scope.block) {
                    owner = owner.parent;
                }

                const definition = owner?.parent?.type === 'Property' ? owner.parent.parent : null;

                if (helperDefinitions.has(definition) && hasInheritedMethod(definition, method)) {
                    return 'form';
                }
            }

            return null;
        });
    }

    function request(call) {
        const callee = unwrapExpression(call.callee);

        if (callee?.type !== 'MemberExpression') {
            return null;
        }

        const method = getStaticPropertyName(callee);

        if (!Object.hasOwn(routerOptionIndexes, method) && !formRequestMethods.has(method) && method !== 'submit') {
            return null;
        }

        const kind = receiverKind(callee.object, method);

        if ((kind === 'router' && Object.hasOwn(routerOptionIndexes, method))
            || (kind === 'form' && (formRequestMethods.has(method) || method === 'submit'))) {
            return { kind: kind, method: method };
        }

        return null;
    }

    function requestOptions(call) {
        const info = request(call);

        if (!info) {
            return null;
        }

        const { kind, method } = info;
        let index;

        if (kind === 'router' && Object.hasOwn(routerOptionIndexes, method)) {
            index = routerOptionIndexes[method];
        } else if (kind === 'form' && formRequestMethods.has(method)) {
            index = 1;
        } else if (kind === 'form' && method === 'submit') {

            // submit(method, url, options), submit(route, options), and
            // configured-form submit(options) have different options positions.
            index = Math.min(call.arguments.length - 1, 2);

            if (index === 0 && ['url', 'method'].every(function (name) {
                return objectProperty(call.arguments[0], name).some(function (value) {
                    return !value.absent;
                });
            })) {
                return null;
            }
        } else {
            return null;
        }

        // A spread before the options makes its argument position uncertain.
        if (call.arguments.slice(0, index + 1).some(function (argument) {
            return argument.type === 'SpreadElement';
        })) {
            return null;
        }

        return unwrapExpression(call.arguments[index]);
    }

    return { resolve: resolve, objectProperty: objectProperty, registerForms: registerForms, receiverKind: receiverKind, request: request, requestOptions: requestOptions };
}
