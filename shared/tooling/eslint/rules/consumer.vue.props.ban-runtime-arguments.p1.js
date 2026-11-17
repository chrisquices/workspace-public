import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';

const primitiveTypes = new Map([['String', 'string'], ['Number', 'number'], ['Boolean', 'boolean']]);

export default {
    meta: {
        type: 'suggestion',
        description: 'Use TypeScript type arguments instead of runtime arguments for defineProps.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            arguments: 'Remove runtime arguments from defineProps and express the prop contract in its TypeScript type argument. Preserve requiredness and review defaults, validators, and callers during the rewrite.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                if (node.arguments.length !== 0) {
                    context.report({
                        node: node,
                        messageId: 'arguments',
                        fix(fixer) {
                            const sourceCode = context.sourceCode;
                            const options = node.arguments[0];
                            const document = sourceCode.parserServices.getDocumentFragment();
                            const script = document.children.find((block) => block.type === 'VElement' && block.rawName === 'script'
                                && block.startTag.range[1] <= node.range[0] && node.range[1] <= block.range[1]);

                            if (node.arguments.length !== 1 || options.type !== 'ObjectExpression' || node.typeArguments || node.optional
                                || sourceCode.getCommentsInside(node).length > 0
                                || !script?.startTag.attributes.some((attribute) => !attribute.directive
                                    && attribute.key.name === 'lang' && attribute.value?.value === 'ts')) return null;

                            const members = [];
                            const names = new Set();
                            for (const property of options.properties) {
                                if (property.type !== 'Property' || property.kind !== 'init' || property.method || property.computed) return null;
                                const name = getStaticPropertyName(property);
                                if (name === null || name === '__proto__' || names.has(name)) return null;
                                names.add(name);

                                let constructor = property.value;
                                let required = false;
                                if (constructor.type === 'ObjectExpression') {
                                    const fields = constructor.properties;
                                    if (fields.some((field) => field.type !== 'Property' || field.kind !== 'init' || field.method || field.computed
                                        || !['type', 'required'].includes(getStaticPropertyName(field)))
                                        || new Set(fields.map(propertyName)).size !== fields.length) return null;
                                    const requiredField = fields.find((field) => getStaticPropertyName(field) === 'required');
                                    if (requiredField && (requiredField.value.type !== 'Literal' || typeof requiredField.value.value !== 'boolean')) return null;
                                    required = requiredField?.value.value ?? false;
                                    constructor = fields.find((field) => getStaticPropertyName(field) === 'type')?.value;
                                }

                                if (constructor?.type !== 'Identifier' || !primitiveTypes.has(constructor.name)
                                    || resolveVariableBinding(constructor, sourceCode)?.defs.length) return null;
                                if (sourceCode.scopeManager.scopes.some((scope) => scope.references.some((reference) =>
                                    reference.identifier.name === constructor.name && reference.isWrite()))) return null;

                                members.push(`${sourceCode.getText(property.key)}${required ? '' : '?'}: ${primitiveTypes.get(constructor.name)};`);
                            }

                            return fixer.replaceText(node, `${sourceCode.getText(node.callee)}<{ ${members.join(' ')} }>()`);
                        },
                    });
                }
            },
        });
    },
};
