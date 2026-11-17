import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const GROUP_NAMES = [
    "props",
    "computed",
    "data",
    "asyncData",
    "methods",
    "setup"
];
function isAllowedVarName(context, variableName) {
    return context.options[0]?.allow?.includes(variableName) ?? false;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use distinct names for template-local bindings and outer bindings.',
        includeInReadme: true,
        schema: [],
        messages: {
            "alreadyDeclaredInUpperScope": "Variable '{{name}}' is already declared in the upper scope." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const jsVars = new Set();
        let scopeStack = null;
        return utils.compositingVisitors(utils.isScriptSetup(context) ? { Program() {
            const globalScope = context.sourceCode.scopeManager.globalScope;
            if (!globalScope) return;
            for (const variable of globalScope.variables) if (variable.defs.length > 0) jsVars.add(variable.name);
            const moduleScope = globalScope.childScopes.find((scope) => scope.type === "module");
            if (!moduleScope) return;
            for (const variable of moduleScope.variables) if (variable.defs.length > 0) jsVars.add(variable.name);
        } } : {}, utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(_node, props) {
            for (const prop of props) if (prop.propName) jsVars.add(prop.propName);
        } }), utils.executeOnVue(context, (obj) => {
            const properties = utils.iterateProperties(obj, new Set(GROUP_NAMES));
            for (const node of properties) jsVars.add(node.name);
        }), utils.defineTemplateBodyVisitor(context, {
            VElement(node) {
                scopeStack = {
                    parent: scopeStack,
                    nodes: scopeStack ? [...scopeStack.nodes] : []
                };
                for (const variable of node.variables) {
                    const varNode = variable.id;
                    const name = varNode.name;
                    if (isAllowedVarName(context, name)) continue;
                    if (scopeStack.nodes.some((node) => node.name === name) || jsVars.has(name)) context.report({
                        node: varNode,
                        loc: varNode.loc,
                        data: { name },
                        messageId: "alreadyDeclaredInUpperScope"
                    });
                    else scopeStack.nodes.push(varNode);
                }
            },
            "VElement:exit"() {
                scopeStack &&= scopeStack.parent;
            }
        }));
    },
};
