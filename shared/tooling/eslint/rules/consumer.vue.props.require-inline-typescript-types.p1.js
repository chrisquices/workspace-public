import { getInlinePropsType } from '#eslint/helpers/get-inline-props-type.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use one inline TypeScript object type argument for defineProps.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            type: 'Pass one inline TypeScript object type to defineProps, such as defineProps<{ customer: Customer }>(). Inline named prop types while preserving prop names, optional markers, unions, and nested types.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                if (!getInlinePropsType(node)) {
                    context.report({
                        node: node,
                        messageId: 'type',
                        fix(fixer) {
                            const sourceCode = context.sourceCode;
                            const types = node.typeArguments?.params;
                            const reference = types?.[0];

                            if (types?.length !== 1 || reference.type !== 'TSTypeReference'
                                || reference.typeName.type !== 'Identifier' || reference.typeArguments) {
                                return null;
                            }

                            const variable = resolveVariableBinding(reference.typeName, sourceCode);
                            const declaration = variable?.defs[0]?.node;

                            if (variable?.defs.length !== 1 || variable.scope !== sourceCode.getScope(node)
                                || declaration?.typeParameters) {
                                return null;
                            }

                            const body = declaration.type === 'TSTypeAliasDeclaration' && declaration.typeAnnotation.type === 'TSTypeLiteral'
                                ? declaration.typeAnnotation
                                : declaration.type === 'TSInterfaceDeclaration' && declaration.extends.length === 0 ? declaration.body : null;

                            if (!body || sourceCode.getCommentsInside(reference).length > 0
                                || sourceCode.getCommentsInside(body).length > 0
                                || sourceCode.getCommentsBefore(declaration.parent?.type === 'ExportNamedDeclaration'
                                    ? declaration.parent : declaration).some(isLineDirective)) {
                                return null;
                            }

                            // Retain the named declaration for its other users and
                            // recursive references. Never expand imports or generics.
                            return fixer.replaceText(reference, sourceCode.getText(body));
                        },
                    });
                }
            },
        });
    },
};
