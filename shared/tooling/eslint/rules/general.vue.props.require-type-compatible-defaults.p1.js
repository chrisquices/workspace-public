import typeAst from "eslint-plugin-vue/dist/utils/ts-utils/ts-ast.js";
import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
const import_ts_ast = { default: typeAst.default };
const NATIVE_TYPES = new Set([
    "String",
    "Number",
    "Boolean",
    "Function",
    "Object",
    "Array",
    "Symbol",
    "BigInt"
]);
const FUNCTION_VALUE_TYPES = new Set([
    "Function",
    "Object",
    "Array"
]);
function getPropertyNode(obj, name) {
    for (const p of obj.properties) if (p.type === "Property" && !p.computed && p.key.type === "Identifier" && p.key.name === name) return p;
    return null;
}
function getTypes(targetNode) {
    const node = utils.skipTSAsExpression(targetNode);
    switch (node.type) {
        case "Identifier": return [node.name];
        case "ArrayExpression": return node.elements.flatMap((item) => item != null && item.type === "Identifier" ? [item.name] : []);
        default: return [];
    }
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use prop default values compatible with their declared types.',
        includeInReadme: true,
        schema: [],
        messages: {
            "invalidType": "Type of the default value for '{{name}}' prop must be a {{types}}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const vueObjectPropsContexts = new Map();
        const scriptSetupPropsContexts = [];
        const defineModelPropsContexts = [];
        let scopeStack = null;
        function onFunctionExit() {
            scopeStack &&= scopeStack.upper;
        }
        function getValueType(targetNode) {
            const node = utils.skipChainExpression(targetNode);
            switch (node.type) {
                case "CallExpression":
                    if (node.callee.type === "Identifier" && NATIVE_TYPES.has(node.callee.name)) return {
                        function: false,
                        type: node.callee.name
                    };
                    break;
                case "TemplateLiteral": return {
                    function: false,
                    type: "String"
                };
                case "Literal": {
                    if (node.value === null && !node.bigint) return null;
                    const type = node.bigint ? "BigInt" : require_casing.capitalize(typeof node.value);
                    if (NATIVE_TYPES.has(type)) return {
                        function: false,
                        type
                    };
                    break;
                }
                case "ArrayExpression": return {
                    function: false,
                    type: "Array"
                };
                case "ObjectExpression": return {
                    function: false,
                    type: "Object"
                };
                case "FunctionExpression": return {
                    function: true,
                    expression: false,
                    type: "Function",
                    functionBody: node.body,
                    returnTypes: []
                };
                case "ArrowFunctionExpression":
                    if (node.expression) {
                        const valueType = getValueType(node.body);
                        return {
                            function: true,
                            expression: true,
                            type: "Function",
                            functionBody: node.body,
                            returnType: valueType ? valueType.type : null
                        };
                    }
                    return {
                        function: true,
                        expression: false,
                        type: "Function",
                        functionBody: node.body,
                        returnTypes: []
                    };
            }
            return null;
        }
        function report(node, prop, expectedTypeNames) {
            const propName = prop.propName ?? `[${context.sourceCode.getText(prop.node.key)}]`;
            context.report({
                node,
                data: {
                    name: propName,
                    types: [...expectedTypeNames].join(" or ").toLowerCase()
                },
                messageId: "invalidType"
            });
        }
        function verifyReturnTypes({ prop, types: typeNames, default: defType }) {
            for (const returnType of defType.returnTypes) {
                if (typeNames.has(returnType.type)) continue;
                report(returnType.node, prop, typeNames);
            }
        }
        function processPropDefs(props, otherDefaultProvider) {
            const propContexts = [];
            function collectDefaultContext(defaultDef, prop, typeNames) {
                const defType = getValueType(defaultDef.expression);
                if (!defType) return;
                if (defType.function) {
                    if (typeNames.has("Function")) return;
                    if (defaultDef.src === "assignment") {
                        report(defaultDef.expression, prop, typeNames);
                        return;
                    }
                    if (defType.expression) {
                        if (!defType.returnType || typeNames.has(defType.returnType)) return;
                        report(defType.functionBody, prop, typeNames);
                    } else propContexts.push({
                        prop,
                        types: typeNames,
                        default: defType
                    });
                } else {
                    if (typeNames.has(defType.type) && (defaultDef.src === "assignment" || !FUNCTION_VALUE_TYPES.has(defType.type))) return;
                    report(defaultDef.expression, prop, defaultDef.src === "assignment" ? typeNames : [...typeNames].map((type) => FUNCTION_VALUE_TYPES.has(type) ? "Function" : type));
                }
            }
            for (const prop of props) {
                let typeList;
                const defaultList = [];
                if (prop.type === "object") {
                    if (prop.value.type === "ObjectExpression") {
                        const type = getPropertyNode(prop.value, "type");
                        if (!type) continue;
                        typeList = getTypes(type.value);
                        const def = getPropertyNode(prop.value, "default");
                        if (def) defaultList.push({
                            src: "defaultProperty",
                            expression: def.value
                        });
                    } else typeList = getTypes(prop.value);
                } else typeList = prop.types;
                if (prop.propName != null) defaultList.push(...otherDefaultProvider(prop.propName));
                if (defaultList.length === 0) continue;
                const typeNames = new Set(typeList.filter((item) => NATIVE_TYPES.has(item)));
                if (typeNames.size === 0) continue;
                for (const defaultDef of defaultList) collectDefaultContext(defaultDef, prop, typeNames);
            }
            return propContexts;
        }
        return utils.compositingVisitors({
            ":function"(node) {
                scopeStack = {
                    upper: scopeStack,
                    body: node.body,
                    returnTypes: null
                };
            },
            ReturnStatement(node) {
                if (!scopeStack || !scopeStack.returnTypes || !node.argument) return;
                const type = getValueType(node.argument);
                if (type) scopeStack.returnTypes.push({
                    type: type.type,
                    node: node.argument
                });
            },
            ":function:exit": onFunctionExit
        }, utils.defineVueVisitor(context, {
            onVueObjectEnter(obj) {
                const propContexts = processPropDefs(utils.getComponentPropsFromOptions(obj).filter((prop) => prop.type === "object" && prop.value.type === "ObjectExpression"), () => []);
                vueObjectPropsContexts.set(obj, propContexts);
            },
            ":function"(node, { node: vueNode }) {
                const data = vueObjectPropsContexts.get(vueNode);
                if (!data || !scopeStack) return;
                for (const { default: defType } of data) if (node.body === defType.functionBody) scopeStack.returnTypes = defType.returnTypes;
            },
            onVueObjectExit(obj) {
                const data = vueObjectPropsContexts.get(obj);
                if (!data) return;
                for (const propContext of data) verifyReturnTypes(propContext);
            }
        }), utils.defineScriptSetupVisitor(context, {
            onDefinePropsEnter(node, baseProps) {
                const props = baseProps.filter((prop) => [
                    "type",
                    "infer-type",
                    "object"
                ].includes(prop.type));
                const { props: defaultsByWithDefaults } = utils.getWithDefaultsPropExpressions(context, node);
                const defaultsByAssignmentPatterns = utils.getDefaultPropExpressionsForPropsDestructure(node);
                const propContexts = processPropDefs(props, function* (propName) {
                    const withDefaults = defaultsByWithDefaults[propName];
                    if (withDefaults) yield {
                        src: "withDefaults",
                        expression: withDefaults
                    };
                    const assignmentPattern = defaultsByAssignmentPatterns[propName];
                    if (assignmentPattern) yield {
                        src: "assignment",
                        expression: assignmentPattern.expression
                    };
                });
                scriptSetupPropsContexts.push({
                    node,
                    props: propContexts
                });
            },
            ":function"(node) {
                if (!scopeStack) return;
                const propsData = scriptSetupPropsContexts.at(-1);
                if (propsData) {
                    for (const { default: defType } of propsData.props) if (node.body === defType.functionBody) scopeStack.returnTypes = defType.returnTypes;
                }
                const modelData = defineModelPropsContexts.at(-1);
                if (modelData) {
                    for (const { default: defType } of modelData.props) if (node.body === defType.functionBody) scopeStack.returnTypes = defType.returnTypes;
                }
            },
            onDefinePropsExit() {
                const data = scriptSetupPropsContexts.pop();
                if (!data) return;
                for (const propContext of data.props) verifyReturnTypes(propContext);
            },
            onDefineModelEnter(node, model) {
                const options = model.options && utils.skipTSAsExpression(model.options);
                let syntheticProp = null;
                let defaultFromOptions = null;
                if (model.typeNode) {
                    syntheticProp = {
                        type: "infer-type",
                        propName: model.name.modelName,
                        node: model.typeNode,
                        required: false,
                        types: import_ts_ast.default.inferRuntimeType(context, model.typeNode)
                    };
                    if (options?.type === "ObjectExpression") defaultFromOptions = getPropertyNode(options, "default");
                } else if (options?.type === "ObjectExpression") syntheticProp = {
                    type: "object",
                    propName: model.name.modelName,
                    key: options,
                    value: options,
                    node
                };
                if (!syntheticProp) return;
                const propContexts = processPropDefs([syntheticProp], function* () {
                    if (defaultFromOptions) yield {
                        src: "defaultProperty",
                        expression: defaultFromOptions.value
                    };
                });
                defineModelPropsContexts.push({
                    node,
                    props: propContexts
                });
            },
            onDefineModelExit() {
                const data = defineModelPropsContexts.pop();
                if (!data) return;
                for (const propContext of data.props) verifyReturnTypes(propContext);
            }
        }));
    },
};
