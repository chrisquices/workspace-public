import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const VALID_MODIFIERS = new Set([
    "lazy",
    "number",
    "trim"
]);
function isValidElement(node) {
    const name = node.name;
    return name === "input" || name === "select" || name === "textarea" || name !== "keep-alive" && name !== "slot" && name !== "transition" && name !== "transition-group" && utils.isCustomComponent(node);
}
function isOptionalChainingMemberExpression(node) {
    return node.type === "ChainExpression" && node.expression.type === "MemberExpression";
}
function isLhs(node) {
    switch (node.type) {
        case "TSAsExpression":
        case "TSNonNullExpression": return isLhs(node.expression);
        case "Identifier":
        case "MemberExpression": return true;
        default: return false;
    }
}
function isMaybeNullObjectMemberExpression(node) {
    if (node.type !== "MemberExpression") return false;
    switch (node.object.type) {
        case "ChainExpression": return true;
        case "Literal": return node.object.value === null && !node.object.bigint;
        case "MemberExpression": return isMaybeNullObjectMemberExpression(node.object);
        default: return false;
    }
}
function getVariable(name, leafNode) {
    let node = leafNode;
    while (node != null) {
        const variables = node.variables;
        const variable = variables && variables.find((v) => v.id.name === name);
        if (variable != null) return variable;
        if (node.parent.type === "VDocumentFragment") break;
        node = node.parent;
    }
    return null;
}

export default {
    meta: {
        type: "problem",
        description: 'Use v-model with an assignable expression on a supported target.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedInvalidElement": "'v-model' directives aren't supported on <{{name}}> elements." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedInputFile": "'v-model' directives don't support 'file' input type." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedArgument": "'v-model' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-model' directives don't support the modifier '{{name}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingValue": "'v-model' directives require that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedOptionalChaining": "Optional chaining cannot appear in 'v-model' directives." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedNonLhsExpression": "'v-model' directives require the attribute value which is valid as LHS." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedNullObject": "'v-model' directive has potential null object property access." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedUpdateIterationVariable": "'v-model' directives cannot update the iteration variable '{{varName}}' itself." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='model']"(node) {
            const element = node.parent.parent;
            const name = element.name;
            if (!isValidElement(element)) context.report({
                node,
                data: { name },
                messageId: "unexpectedInvalidElement"
            });
            if (name === "input" && utils.hasAttribute(element, "type", "file")) context.report({
                node,
                messageId: "unexpectedInputFile"
            });
            if (!utils.isCustomComponent(element)) {
                if (node.key.argument) context.report({
                    node: node.key.argument,
                    messageId: "unexpectedArgument"
                });
                for (const modifier of node.key.modifiers) if (!VALID_MODIFIERS.has(modifier.name)) context.report({
                    node: modifier,
                    data: { name: modifier.name },
                    messageId: "unexpectedModifier"
                });
            }
            if (!node.value || utils.isEmptyValueDirective(node, context)) {
                context.report({
                    node,
                    messageId: "missingValue"
                });
                return;
            }
            const expression = node.value.expression;
            if (!expression) return;
            if (isOptionalChainingMemberExpression(expression)) context.report({
                node: expression,
                messageId: "unexpectedOptionalChaining"
            });
            else if (!isLhs(expression)) context.report({
                node: expression,
                messageId: "unexpectedNonLhsExpression"
            });
            else if (isMaybeNullObjectMemberExpression(expression)) context.report({
                node: expression,
                messageId: "unexpectedNullObject"
            });
            for (const reference of node.value.references) {
                const id = reference.id;
                if (id.parent.type !== "VExpressionContainer") continue;
                if (getVariable(id.name, element) != null) context.report({
                    node: expression,
                    data: { varName: id.name },
                    messageId: "unexpectedUpdateIterationVariable"
                });
            }
        } });
    },
};
