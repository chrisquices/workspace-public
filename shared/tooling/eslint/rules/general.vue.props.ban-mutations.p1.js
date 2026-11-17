import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const GLOBALS_WHITE_LISTED = new Set([
    "Infinity",
    "undefined",
    "NaN",
    "isFinite",
    "isNaN",
    "parseFloat",
    "parseInt",
    "decodeURI",
    "decodeURIComponent",
    "encodeURI",
    "encodeURIComponent",
    "Math",
    "Number",
    "Date",
    "Array",
    "Object",
    "Boolean",
    "String",
    "RegExp",
    "Map",
    "Set",
    "JSON",
    "Intl",
    "BigInt"
]);
function getVExpressionContainer(node) {
    let n = node;
    while (n.type !== "VExpressionContainer") n = n.parent;
    return n;
}
function isVmReference(node) {
    if (node.type !== "Identifier") return false;
    const parent = node.parent;
    if (parent.type === "MemberExpression") {
        if (parent.property === node) return false;
    } else if (parent.type === "Property" && parent.key === node && !parent.computed) return false;
    const exprContainer = getVExpressionContainer(node);
    for (const reference of exprContainer.references) {
        if (reference.variable != null) continue;
        if (reference.id === node) return true;
    }
    return false;
}
function parseOptions(options) {
    return Object.assign({ shallowOnly: false }, options);
}

export default {
    meta: {
        type: "suggestion",
        description: 'Do not mutate Vue props; request changes from the parent or use local state.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedMutation": "Unexpected mutation of \"{{key}}\" prop." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"shallowOnly":false}];

        const { shallowOnly } = parseOptions(ruleOptions[0]);
        const propsMap = new Map();
        let vueObjectData = null;
        function report(node, name) {
            context.report({
                node,
                data: { key: name },
                messageId: "unexpectedMutation"
            });
        }
        function getPropertyNameText(node) {
            const name = utils.getStaticPropertyName(node);
            if (name) return name;
            if (node.computed) {
                const expr = node.type === "Property" ? node.key : node.property;
                return `[${context.sourceCode.getText(expr)}]`;
            }
            return "?unknown?";
        }
        function verifyMutating(props, name, isRootProps = false) {
            const invalid = utils.findMutating(props);
            if (invalid && isShallowOnlyInvalid(invalid, isRootProps)) report(invalid.node, name);
        }
        function* iteratePatternProperties(param, path) {
            if (!param) return;
            switch (param.type) {
                case "Identifier":
                    yield {
                        node: param,
                        path
                    };
                    break;
                case "RestElement":
                    yield* iteratePatternProperties(param.argument, path);
                    break;
                case "AssignmentPattern":
                    yield* iteratePatternProperties(param.left, path);
                    break;
                case "ObjectPattern":
                    for (const prop of param.properties) if (prop.type === "Property") {
                        const name = getPropertyNameText(prop);
                        yield* iteratePatternProperties(prop.value, [...path, name]);
                    } else if (prop.type === "RestElement") yield* iteratePatternProperties(prop.argument, path);
                    break;
                case "ArrayPattern": for (let index = 0; index < param.elements.length; index++) {
                    const element = param.elements[index];
                    if (element) yield* iteratePatternProperties(element, [...path, String(index)]);
                }
            }
        }
        function verifyPropVariable(prop, path) {
            const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, prop), prop);
            if (!variable) return;
            for (const reference of variable.references) {
                if (!reference.isRead()) continue;
                const id = reference.identifier;
                const invalid = utils.findMutating(id);
                if (!invalid || !isShallowOnlyInvalid(invalid, path.length === 0)) continue;
                let name;
                if (path.length === 0) {
                    if (invalid.pathNodes.length === 0) continue;
                    const mem = invalid.pathNodes[0];
                    name = getPropertyNameText(mem);
                } else {
                    if (invalid.pathNodes.length === 0 && invalid.kind !== "call") continue;
                    name = path[0];
                }
                report(invalid.node, name);
            }
        }
        function* extractDefineVariableNames() {
            const globalScope = context.sourceCode.scopeManager.globalScope;
            if (!globalScope) return;
            for (const variable of globalScope.variables) if (variable.defs.length > 0) yield variable.name;
            const moduleScope = globalScope.childScopes.find((scope) => scope.type === "module");
            const moduleVariables = moduleScope && moduleScope.variables || [];
            for (const variable of moduleVariables) if (variable.defs.length > 0) yield variable.name;
        }
        /**
        * Is shallowOnly false or the prop reassigned
        */
        function isShallowOnlyInvalid(invalid, isRootProps) {
            return !shallowOnly || invalid.pathNodes.length === (isRootProps ? 1 : 0) && ["assignment", "update"].includes(invalid.kind);
        }
        return utils.compositingVisitors({}, utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(node, props) {
            const defineVariableNames = new Set(extractDefineVariableNames());
            const propsInfo = {
                name: "",
                set: new Set(props.map((p) => p.propName).filter((propName) => utils.isDef(propName) && !GLOBALS_WHITE_LISTED.has(propName) && !defineVariableNames.has(propName)))
            };
            propsMap.set(node, propsInfo);
            vueObjectData = {
                type: "setup",
                object: node
            };
            let target = node;
            if (target.parent && target.parent.type === "CallExpression" && target.parent.arguments[0] === target && target.parent.callee.type === "Identifier" && target.parent.callee.name === "withDefaults") target = target.parent;
            if (!target.parent || target.parent.type !== "VariableDeclarator" || target.parent.init !== target) return;
            const patternProperties = iteratePatternProperties(target.parent.id, []);
            for (const { node: prop, path } of patternProperties) {
                if (path.length === 0) propsInfo.name = prop.name;
                else propsInfo.set.add(prop.name);
                verifyPropVariable(prop, path);
            }
        } }), utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                propsMap.set(node, { set: new Set(utils.getComponentPropsFromOptions(node).map((p) => p.propName).filter(utils.isDef)) });
            },
            onVueObjectExit(node, { type }) {
                if (type !== "instance" && (!vueObjectData || vueObjectData.type !== "export" && vueObjectData.type !== "setup")) vueObjectData = {
                    type,
                    object: node
                };
            },
            onSetupFunctionEnter(node) {
                const propsParam = node.params[0];
                if (!propsParam || propsParam.type === "RestElement" || propsParam.type === "ArrayPattern") return;
                const patternProperties = iteratePatternProperties(propsParam, []);
                for (const { node: prop, path } of patternProperties) verifyPropVariable(prop, path);
            },
            "MemberExpression > :matches(Identifier, ThisExpression)"(node, { node: vueNode }) {
                if (!utils.isThis(node, context)) return;
                const mem = node.parent;
                if (mem.object !== node) return;
                const name = utils.getStaticPropertyName(mem);
                if (name && propsMap.get(vueNode).set.has(name)) verifyMutating(mem, name);
            }
        }), utils.defineTemplateBodyVisitor(context, {
            "VExpressionContainer MemberExpression > ThisExpression"(node) {
                if (!vueObjectData) return;
                const mem = node.parent;
                if (mem.object !== node) return;
                const name = utils.getStaticPropertyName(mem);
                if (name && propsMap.get(vueObjectData.object).set.has(name)) verifyMutating(mem, name);
            },
            "VExpressionContainer Identifier"(node) {
                if (!vueObjectData || !isVmReference(node)) return;
                const propsInfo = propsMap.get(vueObjectData.object);
                const isRootProps = propsInfo.name === node.name;
                const parent = node.parent;
                const name = isRootProps && parent.type === "MemberExpression" && utils.getStaticPropertyName(parent) || node.name;
                if (name && (isRootProps || propsInfo.set.has(name))) verifyMutating(node, name, isRootProps);
            },
            "VAttribute[directive=true]:matches([key.name.name='model'], [key.name.name='bind']) VExpressionContainer > *"(node) {
                if (!vueObjectData) return;
                let attr = node.parent;
                while (attr && attr.type !== "VAttribute") attr = attr.parent;
                if (attr && attr.directive && attr.key.name.name === "bind" && attr.key.modifiers.every((mod) => mod.name !== "sync")) return;
                const propsInfo = propsMap.get(vueObjectData.object);
                const nodes = utils.getMemberChaining(node);
                const first = nodes[0];
                let name;
                if (isVmReference(first)) {
                    if (first.name === propsInfo.name) {
                        if (shallowOnly && nodes.length > 2) return;
                        name = nodes[1] && getPropertyNameText(nodes[1]) || first.name;
                    } else {
                        if (shallowOnly && nodes.length > 1) return;
                        name = first.name;
                        if (!name || !propsInfo.set.has(name)) return;
                    }
                } else if (first.type === "ThisExpression") {
                    if (shallowOnly && nodes.length > 2) return;
                    const mem = nodes[1];
                    if (!mem) return;
                    name = utils.getStaticPropertyName(mem);
                    if (!name || !propsInfo.set.has(name)) return;
                } else return;
                report(node, name);
            }
        }));
    },
};
