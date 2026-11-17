import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';

const unknownString = { prefix: '', complete: false };

function isInternal(value) {
    const text = value.trim();

    return Boolean(text) && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(text);
}

export default {
    meta: {
        type: 'problem',
        description: 'Use generated route helpers for internal native link destinations in Vue templates.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Replace this hardcoded internal URL with an existing project routing helper for the same destination. Preserve route parameters, query data, HTTP method, and request or navigation options. Check the generated routes or controller actions to select the helper.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);

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

        function isVueLink(element) {
            return element.rawName === 'a';
        }

        function checkVueAttribute(attribute) {
            if (!isVueLink(attribute.parent.parent)) {
                return;
            }

            if (!attribute.directive) {
                if (attribute.key.name === 'href' && isInternal(attribute.value?.value ?? '')) {
                    context.report({ node: attribute, messageId: 'forbidden' });
                }

                return;
            }

            if (attribute.key.name.name !== 'bind') {
                return;
            }

            const argument = attribute.key.argument;
            const isHref = argument?.type === 'VIdentifier' ? argument.name === 'href'
                : argument && strings(argument.expression).some(function (value) {
                    return value.complete && value.prefix === 'href';
                });
            const hardcoded = argument ? isHref && hasHardcodedUrl(attribute.value?.expression)
                : bindings.objectProperty(attribute.value?.expression, 'href').some(function (value) {
                    return value.expression && hasHardcodedUrl(value.expression, value.seen);
                });

            if (hardcoded) {
                context.report({ node: attribute, messageId: 'forbidden' });
            }
        }

        return sourceCode.parserServices.defineTemplateBodyVisitor?.({ VAttribute: checkVueAttribute }) ?? {};
    },
};
