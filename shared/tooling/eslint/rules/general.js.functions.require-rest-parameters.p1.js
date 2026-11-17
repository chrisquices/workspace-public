function getVariableOfArguments(scope) {
    const variables = scope.variables;

    for (let i = 0; i < variables.length; ++i) {
        const variable = variables[i];

        if (variable.name === "arguments") {
            /*
             * If there was a parameter which is named "arguments", the implicit "arguments" is not defined.
             * So does fast return with null.
             */
            return variable.identifiers.length === 0 ? variable : null;
        }
    }

    /* c8 ignore next */
    return null;
}
function isNotNormalMemberAccess(reference) {
    const id = reference.identifier;
    const parent = id.parent;

    return !(
        parent.type === "MemberExpression" &&
        parent.object === id &&
        !parent.computed
    );
}

export default {
    meta: {
        type: "suggestion",
        description: "Use rest parameters instead of the arguments object.",
        includeInReadme: true,
        schema: [],
        messages: {
            "preferRestParams": "Use the rest parameters instead of 'arguments'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const sourceCode = context.sourceCode;

        /**
         * Reports a given reference.
         * @param {Reference} reference A reference to report.
         * @returns {void}
         */
        function report(reference) {
            context.report({
                node: reference.identifier,
                loc: reference.identifier.loc,
                messageId: "preferRestParams"
            });
        }

        /**
         * Reports references of the implicit `arguments` variable if exist.
         * @param {ASTNode} node The node representing the function.
         * @returns {void}
         */
        function checkForArguments(node) {
            const argumentsVar = getVariableOfArguments(
                sourceCode.getScope(node),
            );

            if (argumentsVar) {
                argumentsVar.references
                    .filter(isNotNormalMemberAccess)
                    .forEach(report);
            }
        }

        return {
            "FunctionDeclaration:exit": checkForArguments,
            "FunctionExpression:exit": checkForArguments,
        };
    },
};
