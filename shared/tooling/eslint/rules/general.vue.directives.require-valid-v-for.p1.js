import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isUsingIterationVar(vFor, vBindKey) {
    if (vBindKey.value == null) return false;
    const references = vBindKey.value.references;
    const variables = vFor.parent.parent.variables;
    return references.some((reference) => variables.some((variable) => variable.id.name === reference.id.name && variable.kind === "v-for"));
}
function checkChildKey(context, vFor, child) {
    const childFor = utils.getDirective(child, "for");
    if (childFor != null) {
        const childForRefs = childFor.value && childFor.value.references || [];
        const variables = vFor.parent.parent.variables;
        if (childForRefs.some((cref) => variables.some((variable) => cref.id.name === variable.id.name && variable.kind === "v-for"))) return;
    }
    checkKey(context, vFor, child);
}
function checkKey(context, vFor, element) {
    const vBindKey = utils.getDirective(element, "bind", "key");
    if (vBindKey == null && element.name === "template") {
        for (const child of element.children) if (child.type === "VElement") checkChildKey(context, vFor, child);
        return;
    }
    if (vBindKey == null && utils.isCustomComponent(element)) context.report({
        node: element.startTag,
        messageId: "requireKey"
    });
    if (vBindKey != null && !isUsingIterationVar(vFor, vBindKey)) context.report({
        node: vBindKey,
        messageId: "keyUseFVorVars"
    });
}

export default {
    meta: {
        type: "problem",
        description: 'Use valid v-for syntax and loop-dependent keys on component iterations.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireKey": "Custom elements in iteration require 'v-bind:key' directives." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "keyUseFVorVars": "Expected 'v-bind:key' directive to use the variables which are defined by the 'v-for' directive." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedArgument": "'v-for' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-for' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValue": "'v-for' directives require that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedExpression": "'v-for' directives require the special syntax '<alias> in <expression>'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "invalidEmptyAlias": "Invalid empty alias." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "invalidAlias": "Invalid alias '{{text}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowEmptyAlias":false}];

        const sourceCode = context.sourceCode;
        const shouldAllowEmptyAlias = (ruleOptions[0] || {}).allowEmptyAlias === true;
        function isValidAlias(alias) {
            return alias ? alias.type === "Identifier" : shouldAllowEmptyAlias;
        }
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='for']"(node) {
            const element = node.parent.parent;
            checkKey(context, node, element);
            if (node.key.argument) context.report({
                node: node.key.argument,
                messageId: "unexpectedArgument"
            });
            const lastModifier = node.key.modifiers.at(-1);
            if (lastModifier) context.report({
                node,
                loc: {
                    start: node.key.modifiers[0].loc.start,
                    end: lastModifier.loc.end
                },
                messageId: "unexpectedModifier"
            });
            if (!node.value || utils.isEmptyValueDirective(node, context)) {
                context.report({
                    node,
                    messageId: "expectedValue"
                });
                return;
            }
            const expr = node.value.expression;
            if (expr == null) return;
            if (expr.type !== "VForExpression") {
                context.report({
                    node: node.value,
                    messageId: "unexpectedExpression"
                });
                return;
            }
            const lhs = expr.left;
            const value = lhs[0];
            const key = lhs[1];
            const index = lhs[2];
            if (value === null && !shouldAllowEmptyAlias) context.report({
                node: expr,
                messageId: "invalidEmptyAlias"
            });
            if (key !== void 0 && !isValidAlias(key)) {
                const isEmptyAlias = !key;
                context.report({
                    node: key || expr,
                    data: isEmptyAlias ? {} : { text: sourceCode.getText(key) },
                    messageId: isEmptyAlias ? "invalidEmptyAlias" : "invalidAlias"
                });
            }
            if (index === void 0 || isValidAlias(index)) return;
            const isEmptyAlias = !index;
            context.report({
                node: index || expr,
                data: isEmptyAlias ? {} : { text: sourceCode.getText(index) },
                messageId: isEmptyAlias ? "invalidEmptyAlias" : "invalidAlias"
            });
        } });
    },
};
