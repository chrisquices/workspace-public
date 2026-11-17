import { createRequire } from "node:module";
const require = createRequire(new URL("./lib/rules/prefer-spread.js", import.meta.resolve("eslint/package.json")));
const astUtils = require("./utils/ast-utils");
function isVariadicApplyCalling(node) {
    return (
        astUtils.isSpecificMemberAccess(node.callee, null, "apply") &&
        node.arguments.length === 2 &&
        node.arguments[1].type !== "ArrayExpression" &&
        node.arguments[1].type !== "SpreadElement"
    );
}
function isValidThisArg(expectedThis, thisArg, context) {
    if (!expectedThis) {
        return astUtils.isNullOrUndefined(thisArg);
    }
    return astUtils.equalTokens(expectedThis, thisArg, context);
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use spread arguments instead of applicable .apply() calls.',
        includeInReadme: true,
        schema: [],
        messages: {
            "preferSpread": "Consider a spread call. Confirm the arguments are iterable and the change preserves the receiver, evaluation order, and behavior; otherwise ask the developer."
        },
    },
    create(context) {

        const sourceCode = context.sourceCode;

        return {
            CallExpression(node) {
                if (!isVariadicApplyCalling(node)) {
                    return;
                }

                const applied = astUtils.skipChainExpression(
                    astUtils.skipChainExpression(node.callee).object,
                );
                const expectedThis =
                    applied.type === "MemberExpression" ? applied.object : null;
                const thisArg = node.arguments[0];

                if (isValidThisArg(expectedThis, thisArg, sourceCode)) {
                    context.report({
                        node,
                        messageId: "preferSpread"
                    });
                }
            },
        };
    },
};
