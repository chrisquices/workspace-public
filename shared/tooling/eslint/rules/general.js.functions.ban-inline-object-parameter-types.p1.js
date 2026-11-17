// Keep function signatures readable by naming object-shaped parameter types.
// Inspect only parameter annotations, including arrays, unions, tuples, and
// generic arguments. Initializers, return types, and named type bodies are not
// parameter annotations. Naming and declaration placement remain manual.
const callableTypes = new Set([
    'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
    'TSDeclareFunction', 'TSEmptyBodyFunctionExpression', 'TSFunctionType',
    'TSConstructorType', 'TSCallSignatureDeclaration',
    'TSConstructSignatureDeclaration', 'TSMethodSignature',
]);

export default {
    meta: {
        type: 'suggestion',
        description: 'Ban inline object types in function and method parameter annotations in favor of named types or interfaces.',
        includeInReadme: true,
        schema: [],
        messages: {
            namedType: 'Replace this inline object parameter type with a named type or interface. Reuse an existing suitable type or extract one, preserving member types, optionality, readonly modifiers, and generic references. App declarations belong in a types folder; shared packages may keep local types.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const reported = new WeakSet();

        function checkFunction(node) {
            for (let parameter of node.params ?? []) {
                while (['TSParameterProperty', 'AssignmentPattern'].includes(parameter.type)) {
                    parameter = parameter.type === 'TSParameterProperty' ? parameter.parameter : parameter.left;
                }
                const annotation = parameter.typeAnnotation
                    ?? (parameter.type === 'RestElement' ? parameter.argument.typeAnnotation : undefined);
                if (!annotation) continue;

                const pending = [annotation];
                while (pending.length) {
                    const type = pending.pop();
                    if (type.type === 'TSTypeLiteral' || type.type === 'TSMappedType') {
                        if (!reported.has(type)) {
                            reported.add(type);
                            context.report({node: type, messageId: 'namedType'});
                        }
                        // One report describes extraction of the whole object;
                        // do not repeat it for each nested object member.
                        continue;
                    }
                    // Nested callback/signature parameters get their own visit.
                    // Their return types and generic constraints stay out of scope.
                    if (callableTypes.has(type.type)) continue;
                    for (const key of sourceCode.visitorKeys[type.type] ?? []) {
                        const children = Array.isArray(type[key]) ? type[key] : [type[key]];
                        for (const child of children) {
                            if (child && typeof child.type === 'string') pending.push(child);
                        }
                    }
                }
            }
        }

        return Object.fromEntries([...callableTypes].map((type) => [type, checkFunction]));
    },
};
