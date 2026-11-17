import { unwrapExpression as unwrap } from '#eslint/helpers/unwrap-expression.js';

function getPropertyName(property) {
    if (
        property.type !== 'Property'
        || property.kind !== 'init'
        || property.computed
        || property.shorthand
    ) {
        return null;
    }

    if (property.key.type === 'Identifier') {
        return property.key.name;
    }

    return typeof property.key.value === 'string'
        ? property.key.value
        : null;
}

function isPassiveExpression(expression) {
    const node = unwrap(expression);

    switch (node?.type) {
        case 'Literal':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            return true;
        case 'TemplateLiteral':
            return node.expressions.length === 0;
        case 'ArrayExpression':
            return node.elements.every(function (element) {
                return !element || isPassiveExpression(element);
            });
        case 'ObjectExpression':
            return node.properties.every(function (property) {
                return property.type === 'Property'
                    && property.kind === 'init'
                    && !property.computed
                    && isPassiveExpression(property.value);
            });
        case 'UnaryExpression': {
            if (['!', 'void', 'typeof'].includes(node.operator)) {
                return isPassiveExpression(node.argument);
            }

            const argument = unwrap(node.argument);
            const numeric = argument?.type === 'Literal'
                && ['number', 'bigint'].includes(typeof argument.value);

            return numeric && ['+', '-', '~'].includes(node.operator)
                && (node.operator !== '+' || typeof argument.value !== 'bigint');
        }
        default:
            return false;
    }
}

export default function createUiEngineOptionsRule({moduleName, factoryName, configOrder}) {
    function createOrderDefinition(entries, path) {
        if (!Array.isArray(entries)) {
            throw new TypeError(`${factoryName}: the order definition for ${path} must be an array.`);
        }

        const definition = new Map();

        for (const entry of entries) {
            const properties = typeof entry === 'string'
                ? [[entry, null]]
                : entry && typeof entry === 'object' && !Array.isArray(entry)
                    ? Object.entries(entry)
                    : [];

            if (properties.length !== 1 || !properties[0][0]) {
                throw new TypeError(`${factoryName}: each order entry in ${path} must name exactly one property.`);
            }

            const [name, children] = properties[0];

            if (definition.has(name)) {
                throw new TypeError(`${factoryName}: ${path}.${name} appears more than once in the order definition.`);
            }

            definition.set(name, {
                rank: definition.size,
                children: typeof entry === 'string' ? null : createOrderDefinition(children, `${path}.${name}`),
            });
        }

        return definition;
    }

    const orderDefinition = createOrderDefinition(configOrder, 'config');

    return {
        meta: {
            type: 'suggestion',
            docs: {
                description: `Require the standard ${factoryName} options structure and configured property order.`,
            },
            fixable: 'code',
            schema: [],
            messages: {
                options: `Call ${factoryName} with one inline options object containing exactly element followed by config.`,
                config: `Write ${factoryName} {{path}} as an inline object with explicit, unique property names. Replace spreads, computed keys, and accessors while preserving their behavior.`,
                order: `Move {{expected}} before {{actual}} in ${factoryName} {{path}}. Preserve property values and callback bodies.`,
                unlisted: `Define an order for {{name}} in the ${factoryName} {{path}} order definition before using it.`,
            },
        },

        create(context) {
            const sourceCode = context.sourceCode;

            function getOrderFixes(fixer, value, ranked, sorted) {
                if (ranked.length !== value.properties.length) return null;

                // Calls, reads, and other potentially observable evaluations keep their relative order.
                const evaluations = ranked.filter(function (entry) {
                    return !isPassiveExpression(entry.property.value);
                });
                const evaluated = new Set(evaluations);
                const reordered = sorted.filter(function (entry) {
                    return evaluated.has(entry);
                });

                if (evaluations.some(function (entry, index) {
                    return entry !== reordered[index];
                })) return null;

                const ranges = new Map(ranked.map(function (entry) {
                    return [entry, [...entry.property.range]];
                }));
                const leading = new Map();
                const comments = sourceCode.getCommentsInside(value);

                for (const comment of comments) {
                    // Directives and region boundaries may affect several properties.
                    if (/\beslint(?:\b|-)|@ts-(?:ignore|expect-error|check|nocheck)\b|^\s*#?\s*(?:end)?region\b/u.test(comment.value)) return null;

                    if (ranked.some(function (entry) {
                        return comment.range[0] >= entry.property.range[0]
                            && comment.range[1] <= entry.property.range[1];
                    })) continue;

                    const index = ranked.findIndex(function (entry) {
                        return entry.property.range[0] >= comment.range[1];
                    });

                    if (index === -1) return null;

                    const previous = ranked[index - 1]?.property;
                    const separator = previous
                        ? sourceCode.getTokenAfter(previous)
                        : sourceCode.getFirstToken(value);
                    const prefix = sourceCode.lines[comment.loc.start.line - 1]
                        .slice(0, comment.loc.start.column);

                    // Move whole-line leading comments; trailing or detached comments remain report-only.
                    if ((previous && separator?.value !== ',')
                        || comment.range[0] < separator.range[1]
                        || comment.loc.start.line <= (previous ?? separator).loc.end.line
                        || prefix.trim()) return null;

                    const entry = ranked[index];
                    const group = leading.get(entry) ?? [];
                    const preceding = group.at(-1);

                    if (preceding && comment.loc.start.line > preceding.loc.end.line + 1) return null;

                    group.push(comment);
                    leading.set(entry, group);
                    ranges.get(entry)[0] = group[0].range[0];
                }

                for (const [entry, group] of leading) {
                    if (entry.property.loc.start.line > group.at(-1).loc.end.line + 1) return null;
                }

                const fixes = [];

                for (let index = 0; index < ranked.length; index++) {
                    if (ranked[index] === sorted[index]) continue;

                    const target = ranges.get(ranked[index]);
                    const replacement = ranges.get(sorted[index]);
                    const location = sourceCode.getLocFromIndex(target[0]);

                    if (leading.has(sorted[index])
                        && sourceCode.lines[location.line - 1].slice(0, location.column).trim()) return null;

                    // Commas and slot whitespace stay in place; property text and its leading comments move together.
                    fixes.push(fixer.replaceTextRange(target, sourceCode.text.slice(...replacement)));
                }

                return fixes;
            }

            function checkPropertyOrder(expression, definition, path) {
                const value = unwrap(expression);

                if (value?.type === 'ArrayExpression') {
                    for (let index = 0; index < value.elements.length; index++) {
                        checkPropertyOrder(value.elements[index], definition, `${path}[${index}]`);
                    }

                    return;
                }

                if (value?.type !== 'ObjectExpression') return;

                const names = value.properties.map(getPropertyName);

                if (names.includes(null) || new Set(names).size !== names.length) {
                    context.report({node: value, messageId: 'config', data: {path}});
                    return;
                }

                const ranked = [];

                for (let index = 0; index < value.properties.length; index++) {
                    const property = value.properties[index];
                    const name = names[index];
                    const entry = definition.get(name);

                    if (!entry) {
                        context.report({node: property, messageId: 'unlisted', data: {name, path}});
                        continue;
                    }

                    ranked.push({property, name, ...entry});
                }

                const sorted = [...ranked].sort(function (left, right) {
                    return left.rank - right.rank;
                });
                const mismatch = ranked.findIndex(function (entry, index) {
                    return entry !== sorted[index];
                });

                if (mismatch !== -1) {
                    context.report({
                        node: ranked[mismatch].property,
                        messageId: 'order',
                        data: {
                            expected: sorted[mismatch].name,
                            actual: ranked[mismatch].name,
                            path,
                        },
                        fix(fixer) {
                            return getOrderFixes(fixer, value, ranked, sorted);
                        },
                    });
                }

                for (const entry of ranked) {
                    if (entry.children !== null) {
                        checkPropertyOrder(entry.property.value, entry.children, `${path}.${entry.name}`);
                    }
                }
            }

            function isEngineFactory(expression) {
                const callee = unwrap(expression);
                const identifier = callee?.type === 'MemberExpression'
                    ? unwrap(callee.object)
                    : callee;

                if (identifier?.type !== 'Identifier') return false;

                let variable;

                for (
                    let scope = sourceCode.getScope(identifier);
                    scope;
                    scope = scope.upper
                ) {
                    variable = scope.set.get(identifier.name);

                    if (variable) break;
                }

                const binding = variable?.defs.find(function (definition) {
                    return definition.type === 'ImportBinding';
                });

                if (
                    binding?.parent?.source?.value !== moduleName
                    || binding.parent.importKind === 'type'
                    || binding.node.importKind === 'type'
                ) {
                    return false;
                }

                if (
                    callee.type === 'Identifier'
                    && binding.node.type === 'ImportSpecifier'
                ) {
                    return (
                        binding.node.imported.name
                        ?? binding.node.imported.value
                    ) === factoryName;
                }

                if (
                    callee.type === 'MemberExpression'
                    && binding.node.type === 'ImportNamespaceSpecifier'
                ) {
                    const name = callee.computed
                        ? callee.property.type === 'Literal'
                            ? callee.property.value
                            : null
                        : callee.property.name;

                    return name === factoryName;
                }

                return false;
            }

            return {
                CallExpression(node) {
                    if (!isEngineFactory(node.callee)) return;

                    const options = unwrap(node.arguments[0]);

                    if (
                        node.arguments.length !== 1
                        || options?.type !== 'ObjectExpression'
                        || options.properties.length !== 2
                        || options.properties.some(function (property) {
                            return property.method;
                        })
                        || getPropertyName(options.properties[0]) !== 'element'
                        || getPropertyName(options.properties[1]) !== 'config'
                    ) {
                        context.report({node, messageId: 'options'});
                        return;
                    }

                    const config = unwrap(options.properties[1].value);

                    if (config?.type !== 'ObjectExpression') {
                        context.report({
                            node: options.properties[1],
                            messageId: 'config',
                            data: {path: 'config'},
                        });
                        return;
                    }

                    checkPropertyOrder(config, orderDefinition, 'config');
                },
            };
        },
    };
}
