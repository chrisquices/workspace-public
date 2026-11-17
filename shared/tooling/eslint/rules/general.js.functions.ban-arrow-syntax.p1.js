import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use ordinary functions except for Vue computed getters and setters.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            forbidden: 'Replace this arrow with an ordinary function. Preserve parameters, type annotations, async behavior, comments, and the return value. Expression bodies require an explicit return. Vue computed getters and setters may use arrows.',
            lexical: 'This arrow depends on {{bindings}} from its surrounding scope. Rewrite it as an ordinary function while preserving that behavior. Capture surrounding values or restructure the code as needed. Vue computed getters and setters may use arrows.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const computedCallbacks = new WeakSet();
        const lexicalBindings = new WeakMap();

        function markLexicalBinding(node, binding) {
            let scope = sourceCode.getScope(node);

            while (scope) {
                if (scope.type === 'class-field-initializer' || scope.type === 'class-static-block') {
                    return;
                }

                if (scope.type === 'function') {
                    if (scope.block.type !== 'ArrowFunctionExpression') {
                        return;
                    }

                    const bindings = lexicalBindings.get(scope.block) ?? new Set();
                    bindings.add(binding);
                    lexicalBindings.set(scope.block, bindings);
                }

                scope = scope.upper;
            }
        }

        return {
            CallExpression(node) {
                const callee = unwrapExpression(node.callee);

                if (callee?.type === 'Identifier' && callee.name === 'eval') {
                    markLexicalBinding(node, 'direct eval scope');
                }

                const binding = resolveImportOrigin(callee, sourceCode);

                if (binding?.source !== 'vue' || binding.name !== 'computed') {
                    return;
                }

                const argument = unwrapExpression(node.arguments[0]);

                if (argument?.type === 'ArrowFunctionExpression') {
                    computedCallbacks.add(argument);
                } else if (argument?.type === 'ObjectExpression') {
                    for (const property of argument.properties) {
                        if (property.type !== 'Property' || property.kind !== 'init' || !['get', 'set'].includes(getStaticPropertyName(property))) {
                            continue;
                        }

                        const callback = unwrapExpression(property.value);

                        if (callback?.type === 'ArrowFunctionExpression') {
                            computedCallbacks.add(callback);
                        }
                    }
                }
            },

            ThisExpression(node) {
                markLexicalBinding(node, 'this');
            },

            Super(node) {
                markLexicalBinding(node, 'super');
            },

            MetaProperty(node) {
                if (node.meta.name === 'new' && node.property.name === 'target') {
                    markLexicalBinding(node, 'new.target');
                }
            },

            'ArrowFunctionExpression:exit'(node) {
                if (computedCallbacks.has(node)) {
                    return;
                }

                const bindings = new Set(lexicalBindings.get(node));
                const scope = sourceCode.getScope(node);

                if (scope.through.some(function (reference) {
                    return reference.identifier.name === 'arguments' && reference.isValueReference !== false;
                })) {
                    bindings.add('arguments');
                }

                context.report({
                    node: node,
                    messageId: bindings.size ? 'lexical' : 'forbidden',
                    data: { bindings: [...bindings].join(', ') },
                    fix(fixer) {
                        if (bindings.size) {
                            return null;
                        }

                        const firstToken = sourceCode.getFirstToken(node);
                        const parameterStart = node.async ? firstToken.range[1] : node.range[0];
                        const firstParameterToken = node.async ? sourceCode.getTokenAfter(firstToken) : firstToken;
                        const arrowToken = sourceCode.getTokenBefore(node.body, {
                            filter: function (token) {
                                return token.value === '=>';
                            },
                        });
                        let parameters = sourceCode.text.slice(parameterStart, arrowToken.range[0]).trim();

                        if (firstParameterToken.range[0] === node.params[0]?.range[0] && !node.typeParameters) {
                            parameters = `(${parameters})`;
                        }

                        const head = `${node.async ? 'async ' : ''}function ${parameters}`;
                        const body = sourceCode.text.slice(arrowToken.range[1], node.range[1]).trim();
                        const functionBody = node.body.type === 'BlockStatement' ? body : `{ return (${body}); }`;

                        return fixer.replaceText(node, `(${head} ${functionBody})`);
                    },
                });
            },
        };
    },
};
