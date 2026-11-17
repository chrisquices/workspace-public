import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function groupingVariables(node) {
    const result = {};
    for (const variable of node.variables) {
        const kind = variable.kind;
        result[kind] ||= [];
        result[kind].push(variable);
    }
    return result;
}
function isDestructuringVar(variable) {
    let parent = variable.id.parent;
    while (parent) {
        if (parent.type === "VForExpression" || parent.type === "VSlotScopeExpression") return false;
        if (parent.type === "Property" || parent.type === "ArrayPattern") return true;
        parent = parent.parent;
    }
    return false;
}
function isUsedAsComponentTag(variableName, element) {
    for (const child of element.children) {
        if (child.type !== "VElement") continue;
        if (child.rawName === variableName || isUsedAsComponentTag(variableName, child)) return true;
    }
    return false;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Remove unused template-local loop and slot bindings where safe.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unusedVariable": "'{{name}}' is defined but never used." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "replaceWithUnderscore": "Replace `{{name}}` with `_{{name}}` to ignore the unused variable." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const ignorePattern = (ruleOptions[0] || {}).ignorePattern;
        const ignoreRegEx = ignorePattern ? new RegExp(ignorePattern, "u") : null;
        /**
        * Checks the variables of a single directive kind.
        */
        function checkVariableGroup(variables, node) {
            let hasAfterUsed = false;
            for (let i = variables.length - 1; i >= 0; i--) {
                const variable = variables[i];
                if (variable.references.length > 0) {
                    hasAfterUsed = true;
                    continue;
                }
                if (ignoreRegEx != null && ignoreRegEx.test(variable.id.name) || hasAfterUsed && !isDestructuringVar(variable) || isUsedAsComponentTag(variable.id.name, node)) continue;
                context.report({
                    node: variable.id,
                    loc: variable.id.loc,
                    data: { name: variable.id.name },
                    messageId: "unusedVariable"
                });
            }
        }
        return utils.defineTemplateBodyVisitor(context, { VElement(node) {
            const vars = groupingVariables(node);
            for (const variables of Object.values(vars)) if (variables) checkVariableGroup(variables, node);
        } });
    },
};
