// Inertia Helper request lifecycle callbacks are explicit function expressions.
// Resolve actual helper receivers and request options using the existing binding
// utilities. Do not inspect unrelated router/useForm calls or similarly named
// object properties. Missing callbacks and unresolved options stay untouched.
// Arrow conversion belongs to js-functions-ban-arrow-syntax; references need
// manual wrappers preserving arguments, return values, and receiver behavior.

import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const lifecycleCallbacks = ['onSuccess', 'onFinish', 'onError'];

export default {
    meta: {
        type: 'suggestion',
        description: 'Use explicit function expressions for Inertia Helper request lifecycle callbacks.',
        includeInReadme: true,
        schema: [],
        fixable: 'code',
        messages: {
            callback: 'Write {{callback}} as {{callback}}: function (...) { ... } in these Inertia Helper request options. Do not pass a function reference, use an arrow, or use shorthand method syntax. Preserve parameters, TypeScript annotations, async behavior, returned values/promises, comments, and this binding. Wrap references manually and forward the required arguments; existing arrow-conversion rules handle safe arrows. Do not add absent callbacks.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);
        const calls = [];
        const reported = new WeakSet();

        // Called only after request() proves a form request. Its ThisExpression
        // support already verifies the enclosing registered helper form method.
        function isHelperReceiver(expression, seen = new Set()) {
            return bindings.resolve(expression, seen, function (node, visited) {
                if (node?.type === 'ThisExpression') return true;
                if (node?.type === 'ConditionalExpression' || node?.type === 'LogicalExpression') {
                    return isHelperReceiver(node.consequent ?? node.left, visited)
                        && isHelperReceiver(node.alternate ?? node.right, visited);
                }
                if (node?.type !== 'CallExpression') return false;

                const factory = resolveImportOrigin(node.callee, sourceCode);
                return factory?.source === 'workspace-packages/inertia-helper' && factory.name === 'useInertiaHelperForm';
            });
        }

        function checkCallback(expression, callbackName) {
            const callback = unwrapExpression(expression);
            if (!callback || reported.has(callback)) return;

            const property = expression.parent?.type === 'Property' && expression.parent.value === expression
                ? expression.parent : null;
            const method = property?.method === true;
            if (callback.type === 'FunctionExpression' && !callback.generator && !method) return;
            reported.add(callback);

            context.report({
                node: property ?? expression,
                messageId: 'callback',
                data: { callback: callbackName },
                fix(fixer) {
                    if (!method || property.kind !== 'init' || property.computed
                        || callback.type !== 'FunctionExpression' || callback.generator
                        || sourceCode.getTokens(callback).some((token) => token.type === 'Keyword' && token.value === 'super')) return null;

                    const insertion = fixer.insertTextAfter(property.key, callback.async ? ': async function' : ': function');
                    if (!callback.async) return insertion;

                    const first = sourceCode.getFirstToken(property);
                    if (first.value !== 'async'
                        || !/^\s*$/u.test(sourceCode.text.slice(first.range[1], property.key.range[0]))) return null;

                    return [fixer.removeRange([first.range[0], property.key.range[0]]), insertion];
                },
            });
        }

        return {
            CallExpression(node) {
                calls.push(node);
            },
            'Program:exit'() {
                bindings.registerForms(calls);

                for (const call of calls) {
                    if (bindings.request(call)?.kind !== 'form') continue;
                    const callee = unwrapExpression(call.callee);
                    if (!isHelperReceiver(callee.object)) continue;

                    const options = bindings.requestOptions(call);
                    if (!options) continue;

                    for (const callbackName of lifecycleCallbacks) {
                        for (const value of bindings.objectProperty(options, callbackName)) {
                            if (value.expression) checkCallback(value.expression, callbackName);
                        }
                    }
                }
            },
        };
    },
};
