import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Bind defineProps to the identifier props.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            name: 'Bind the defineProps result to the single identifier props. Replace destructuring or other names and update affected script and template references.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                const declaration = getVariableDeclarator(node);

                if (declaration && (declaration.id.type !== 'Identifier' || declaration.id.name !== 'props')) {
                    context.report({
                        node: node,
                        messageId: 'name',
                        fix(fixer) {
                            const sourceCode = context.sourceCode;
                            if (declaration.id.type !== 'Identifier' || declaration.parent.parent.type !== 'Program') return null;

                            const variable = resolveVariableBinding(declaration.id, sourceCode);
                            if (!variable || variable.defs.length !== 1) return null;

                            const template = sourceCode.ast.templateBody;
                            const tokens = [...sourceCode.getTokens(sourceCode.ast),
                                ...(template ? sourceCode.parserServices.getTemplateBodyTokenStore().getTokens(template) : [])];
                            if (tokens.some((token) => ['props', 'eval'].includes(token.value)) || /\bv-bind\s*\(/u.test(sourceCode.text)) return null;

                            const identifiers = [declaration.id, ...variable.references
                                .filter((reference) => !reference.vueUsedInTemplate).map((reference) => reference.identifier)];
                            const pending = template ? [template] : [];

                            for (const current of pending) {
                                // Component tags and string refs are not expression
                                // references; leave those less common usages manual.
                                if (current.type === 'VElement' && (current.rawName.toLowerCase() === declaration.id.name.toLowerCase()
                                    || current.rawName.startsWith(`${declaration.id.name}.`))) return null;
                                if (current.type === 'VAttribute' && !current.directive && current.key.name === 'ref'
                                    && current.value?.value === declaration.id.name) return null;

                                if (current.type === 'VExpressionContainer') {
                                    for (const reference of current.references) {
                                        if (reference.id.name === declaration.id.name && resolveVariableBinding(reference.id, sourceCode) === variable) {
                                            identifiers.push(reference.id);
                                        }
                                    }
                                }
                                for (const key of sourceCode.visitorKeys[current.type] ?? []) {
                                    const children = Array.isArray(current[key]) ? current[key] : [current[key]];
                                    pending.push(...children.filter((child) => child?.type));
                                }
                            }

                            // Keep public export names and shorthand property keys
                            // intact. The existing shorthand rule can expand those
                            // properties first, making a later rename unambiguous.
                            if (identifiers.some((identifier) => identifier.parent?.type === 'ExportSpecifier'
                                || (identifier.parent?.type === 'Property' && identifier.parent.shorthand)
                                || (identifier.parent?.type === 'AssignmentPattern' && identifier.parent.parent?.shorthand))) return null;

                            const unique = new Map(identifiers.map((identifier) => [identifier.range[0], identifier]));
                            return [...unique.values()].map((identifier) => fixer.replaceText(identifier, 'props'));
                        },
                    });
                }
            },
        });
    },
};
