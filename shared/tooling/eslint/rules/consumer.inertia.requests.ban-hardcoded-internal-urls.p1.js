import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';

const routerMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'visit', 'prefetch', 'push', 'replace']);
const formMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'submit']);
const unknownString = { prefix: '', complete: false };

function isInternal(value) {
    const text = value.trim();

    return Boolean(text) && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(text);
}

export default {
    meta: {
        type: 'problem',
        description: 'Use generated route helpers for internal Inertia request destinations.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Replace this hardcoded internal URL with an existing project routing helper for the same destination. Preserve route parameters, query data, HTTP method, and request or navigation options. Check the generated routes or controller actions to select the helper.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);
        const calls = [];

        function joinStrings(left, right) {
            return left.flatMap(function (start) {
                return right.map(function (end) {
                    return {
                        prefix: start.complete ? start.prefix + end.prefix : start.prefix,
                        complete: start.complete && end.complete,
                    };
                });
            });
        }

        function strings(expression, seen = new Set()) {
            return bindings.resolve(expression, seen, function (node, visited) {
                if (!node) {
                    return [unknownString];
                }

                if (node.type === 'Literal' && typeof node.value === 'string') {
                    return [{ prefix: node.value, complete: true }];
                }

                if (node.type === 'ConditionalExpression') {
                    return [...strings(node.consequent, visited), ...strings(node.alternate, visited)];
                }

                if (node.type === 'LogicalExpression') {
                    return [...strings(node.left, visited), ...strings(node.right, visited)];
                }

                if (node.type === 'BinaryExpression' && node.operator === '+') {
                    return joinStrings(strings(node.left, visited), strings(node.right, visited));
                }

                if (node.type === 'TemplateLiteral') {
                    let values = [{ prefix: node.quasis[0].value.cooked ?? node.quasis[0].value.raw, complete: true }];

                    for (let index = 0; index < node.expressions.length; index++) {
                        values = joinStrings(values, strings(node.expressions[index], visited));
                        values = joinStrings(values, [{ prefix: node.quasis[index + 1].value.cooked ?? node.quasis[index + 1].value.raw, complete: true }]);
                    }

                    return values;
                }

                return [unknownString];
            });
        }

        function hasHardcodedUrl(expression, seen = new Set()) {
            return bindings.resolve(expression, seen, function (node, visited) {
                if (!node) {
                    return false;
                }

                if (node.type === 'ConditionalExpression') {
                    return hasHardcodedUrl(node.consequent, visited) || hasHardcodedUrl(node.alternate, visited);
                }

                if (node.type === 'LogicalExpression') {
                    return hasHardcodedUrl(node.left, visited) || hasHardcodedUrl(node.right, visited);
                }

                if (node.type === 'ObjectExpression') {
                    return bindings.objectProperty(node, 'url', visited).some(function (value) {
                        return value.expression && hasHardcodedUrl(value.expression, value.seen);
                    });
                }

                return strings(node, visited).some(function (value) {
                    return isInternal(value.prefix);
                });
            });
        }

        function checkCall(node) {
            const callee = unwrapExpression(node.callee);

            if (callee?.type !== 'MemberExpression') {
                return;
            }

            const method = getStaticPropertyName(callee);

            if (!routerMethods.has(method) && !formMethods.has(method)) {
                return;
            }

            const kind = bindings.receiverKind(callee.object, method);

            if ((kind !== 'router' || !routerMethods.has(method)) && (kind !== 'form' || !formMethods.has(method))) {
                return;
            }

            let destinationIndex = 0;

            if (method === 'submit') {
                const first = node.arguments[0];
                const hasMethod = strings(first).some(function (value) {
                    return value.complete && /^(get|post|put|patch|delete|head|options)$/iu.test(value.prefix);
                });
                const isRouteObject = bindings.resolve(first, new Set(), function (value) {
                    return value?.type === 'ObjectExpression';
                });
                const hasUrlArgument = strings(node.arguments[1]).some(function (value) {
                    return Boolean(value.prefix);
                });

                if (!isRouteObject && (hasMethod || hasUrlArgument || node.arguments.length >= 3)) {
                    destinationIndex = 1;
                }
            }

            if (node.arguments.slice(0, destinationIndex + 1).some(function (argument) {
                return argument.type === 'SpreadElement';
            })) {
                return;
            }

            const destination = node.arguments[destinationIndex];

            if (hasHardcodedUrl(destination)) {
                context.report({ node: destination, messageId: 'forbidden' });
            }
        }

        const scriptVisitor = {
            CallExpression(node) { calls.push(node); },
            'Program:exit'() {
                bindings.registerForms(calls);
                for (const call of calls) checkCall(call);
            },
        };
        return sourceCode.parserServices.defineTemplateBodyVisitor?.({ CallExpression: checkCall }, scriptVisitor) ?? scriptVisitor;
    },
};
