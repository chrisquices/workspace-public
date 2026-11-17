import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const GROUP_NAMES = [
    "props",
    "computed",
    "data",
    "methods",
    "setup"
];
function getPropsPattern(node) {
    let target = node;
    if (target.parent && target.parent.type === "CallExpression" && target.parent.arguments[0] === target && target.parent.callee.type === "Identifier" && target.parent.callee.name === "withDefaults") target = target.parent;
    return target.parent?.type === "VariableDeclarator" && target.parent.init === target ? target.parent.id : null;
}
function isInsideInitializer(node, references) {
    const init = node.init;
    return init !== null && references.some((id) => init.range[0] <= id.range[0] && id.range[1] <= init.range[1]);
}
function getAliasedPropName(node, propReferences) {
    const expression = utils.skipChainExpression(utils.skipTSAsExpression(node));
    if (expression.type === "MemberExpression") return propReferences.includes(utils.skipTSAsExpression(expression.object)) ? utils.getStaticPropertyName(expression) : null;
    if (expression.type === "CallExpression" && expression.callee.type === "Identifier" && expression.callee.name === "toRef" && propReferences.includes(expression.arguments[0])) {
        const key = expression.arguments[1];
        return key?.type === "Literal" && typeof key.value === "string" ? key.value : null;
    }
    return null;
}
function isPropsObject(node, propReferences) {
    return propReferences.includes(node) || node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "toRefs" && propReferences.includes(node.arguments[0]);
}
function aliasesOtherProp(node, propName, propReferences) {
    const init = node.init;
    if (!init) return false;
    if (node.id.type === "Identifier" && node.id.name === propName) {
        const aliased = getAliasedPropName(init, propReferences);
        return aliased !== null && aliased !== propName;
    }
    if (node.id.type === "ObjectPattern" && isPropsObject(init, propReferences)) for (const property of node.id.properties) {
        if (property.type !== "Property") continue;
        const value = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
        if (value.type !== "Identifier" || value.name !== propName) continue;
        const key = utils.getStaticPropertyName(property);
        return key !== null && key !== propName;
    }
    return false;
}
function collectRenamedProps(pattern) {
    const renamedProps = new Set();
    if (!pattern || pattern.type !== "ObjectPattern") return renamedProps;
    for (const prop of pattern.properties) {
        if (prop.type !== "Property") continue;
        if (prop.key.type === "Identifier" && prop.value.type === "Identifier" && prop.key.name !== prop.value.name) renamedProps.add(prop.key.name);
    }
    return renamedProps;
}

export default {
    meta: {
        type: "problem",
        description: 'Use distinct names for component members across props, data, computed, methods, and setup.',
        includeInReadme: true,
        schema: [],
        messages: {
            "duplicateKey": "Duplicate key '{{name}}'. May cause name collision in script or template tag." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const options = ruleOptions[0] || {};
        const groups = new Set([...GROUP_NAMES, ...options.groups || []]);
        let propReferences = [];
        const propNames = new Set();
        const models = [];
        const reportedDeclarations = new Set();
        return utils.compositingVisitors(utils.executeOnVue(context, (obj) => {
            const properties = utils.iterateProperties(obj, groups);
            const usedNames = new Set();
            for (const o of properties) {
                if (usedNames.has(o.name)) context.report({
                    node: o.node,
                    data: { name: o.name },
                    messageId: "duplicateKey"
                });
                usedNames.add(o.name);
            }
        }), utils.defineScriptSetupVisitor(context, {
            onDefinePropsEnter(node, props) {
                const propsNode = getPropsPattern(node);
                propReferences = [...propsNode ? extractReferences(propsNode) : [], node];
                const renamedProps = collectRenamedProps(propsNode);
                for (const prop of props) {
                    const propName = prop.propName;
                    if (!propName) continue;
                    propNames.add(propName);
                    if (renamedProps.has(propName)) continue;
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), propName);
                    if (!variable || variable.defs.length === 0 || variable.defs.some((def) => def.type === "Variable" && !aliasesOtherProp(def.node, propName, propReferences) && isInsideInitializer(def.node, propReferences))) continue;
                    reportedDeclarations.add(variable.defs[0].node);
                    context.report({
                        node: variable.defs[0].node,
                        data: { name: propName },
                        messageId: "duplicateKey"
                    });
                }
            },
            onDefineModelEnter(node, model) {
                models.push({
                    node,
                    model
                });
            },
            "Program:exit"() {
                const usedNames = new Set(propNames);
                for (const { node, model } of models) {
                    const name = model.name.modelName;
                    if (usedNames.has(name)) {
                        if (reportedDeclarations.has(node.parent)) continue;
                        context.report({
                            node: model.name.node || node,
                            data: { name },
                            messageId: "duplicateKey"
                        });
                        continue;
                    }
                    usedNames.add(name);
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), name);
                    if (!variable || variable.defs.length === 0) continue;
                    const modelPattern = getPropsPattern(node);
                    const modelReferences = [
                        ...propReferences,
                        ...modelPattern ? extractReferences(modelPattern) : [],
                        node
                    ];
                    if (variable.defs.some((def) => def.type === "Variable" && isInsideInitializer(def.node, modelReferences))) continue;
                    context.report({
                        node: variable.defs[0].node,
                        data: { name },
                        messageId: "duplicateKey"
                    });
                }
            }
        }));
        /**
        * Extracts references from the given node.
        */
        function extractReferences(node) {
            switch (node.type) {
                case "Identifier": {
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
                    return variable ? variable.references.map((ref) => ref.identifier) : [];
                }
                case "ObjectPattern": return node.properties.flatMap((prop) => extractReferences(prop.type === "Property" ? prop.value : prop));
                case "AssignmentPattern": return extractReferences(node.left);
                case "RestElement": return extractReferences(node.argument);
                default: return [];
            }
        }
    },
};
