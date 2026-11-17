import require_index from "eslint-plugin-vue/dist/utils/index.js";
import { getStaticValue } from "@eslint-community/eslint-utils";
const utils = require_index.default;
const GROUPS = new Set([
    "data",
    "props",
    "computed",
    "methods"
]);
const NATIVE_NOT_FUNCTION_TYPES = new Set([
    "String",
    "Number",
    "BigInt",
    "Boolean",
    "Object",
    "Array",
    "Symbol"
]);
function resolvedExpressions(context, node) {
    const resolvedMap = new Map();
    return resolvedExpressionsInternal(node);
    function resolvedExpressionsInternal(node) {
        let resolvedSet = resolvedMap.get(node);
        if (!resolvedSet) {
            resolvedSet = new Set();
            resolvedMap.set(node, resolvedSet);
            for (const e of extractResolvedExpressions(node)) resolvedSet.add(e);
        }
        if (resolvedSet.size === 0) resolvedSet.add(node);
        return resolvedSet;
    }
    function* extractResolvedExpressions(node) {
        switch (node.type) {
            case "Identifier": {
                const variable = utils.findVariableByIdentifier(context, node);
                if (variable) for (const ref of variable.references) {
                    const id = ref.identifier;
                    if (id.parent.type === "VariableDeclarator") {
                        if (id.parent.id === id && id.parent.init) yield* resolvedExpressionsInternal(id.parent.init);
                    } else if (id.parent.type === "AssignmentExpression" && id.parent.left === id) yield* resolvedExpressionsInternal(id.parent.right);
                }
                break;
            }
            case "ConditionalExpression":
                yield* resolvedExpressionsInternal(node.consequent);
                yield* resolvedExpressionsInternal(node.alternate);
                break;
            case "LogicalExpression":
                yield* resolvedExpressionsInternal(node.left);
                yield* resolvedExpressionsInternal(node.right);
        }
    }
}
function getComponentPropsTypes(context, prop) {
    const result = [];
    for (const expr of resolvedExpressions(context, prop.property.value)) {
        const types = getComponentPropsTypesFromExpression(expr);
        if (types == null) return null;
        result.push(...types);
    }
    return result;
    function getComponentPropsTypesFromExpression(expr) {
        let typeExprs;
        /**
        * Check object props `props: { objectProps: {...} }`
        */
        if (expr.type === "ObjectExpression") {
            const type = utils.findProperty(expr, "type");
            if (type == null) return null;
            typeExprs = resolvedExpressions(context, type.value);
        } else typeExprs = [expr];
        const result = [];
        for (const typeExpr of typeExprs) {
            const types = getComponentPropsTypesFromTypeExpression(typeExpr);
            if (types == null) return null;
            result.push(...types);
        }
        return result;
    }
    function getComponentPropsTypesFromTypeExpression(typeExpr) {
        if (typeExpr.type === "Identifier") return [typeExpr.name];
        if (typeExpr.type === "ArrayExpression") {
            const types = [];
            for (const element of typeExpr.elements) {
                if (!element) continue;
                if (element.type === "SpreadElement") return null;
                for (const elementExpr of resolvedExpressions(context, element)) {
                    if (elementExpr.type !== "Identifier") return null;
                    types.push(elementExpr.name);
                }
            }
            return types;
        }
        return null;
    }
}
const NON_FUNCTION_EXPRESSION_TYPES = new Set([
    "ObjectExpression",
    "ArrayExpression",
    "Literal",
    "TemplateLiteral",
    "BinaryExpression",
    "UnaryExpression",
    "UpdateExpression"
]);
function canBeFunction(context, node) {
    for (const expr of resolvedExpressions(context, node)) {
        if (NON_FUNCTION_EXPRESSION_TYPES.has(expr.type) || expr.type === "ConditionalExpression" && !canBeFunction(context, expr.consequent) && !canBeFunction(context, expr.alternate)) continue;
        const evaluated = getStaticValue(expr, utils.getScope(context, expr));
        if (!evaluated || typeof evaluated.value === "function") return true;
    }
    return false;
}
var FunctionData = class {
    context;
    name;
    kind;
    node;
    returnValues;
    cacheMaybeReturnFunction;
    constructor(name, kind, node, context) {
        this.context = context;
        this.name = name;
        this.kind = kind;
        this.node = node;
        this.returnValues = [];
        this.cacheMaybeReturnFunction = null;
    }
    addReturnValue(node) {
        this.returnValues.push(node);
    }
    maybeReturnFunction(component) {
        if (this.cacheMaybeReturnFunction != null) return this.cacheMaybeReturnFunction;
        this.cacheMaybeReturnFunction = true;
        return this.cacheMaybeReturnFunction = this.returnValues.some((returnValue) => returnValue && component.maybeFunctionExpression(returnValue));
    }
};
var ComponentStack = class {
    node;
    context;
    /** Upper scope component */
    upper;
    maybeFunctions;
    functions;
    callMembers;
    cacheMaybeFunctionExpressions;
    constructor(node, context, upper) {
        this.node = node;
        this.context = context;
        this.upper = upper;
        const maybeFunctions = new Map();
        const functions = [];
        function collectProperty(property) {
            switch (property.groupName) {
                case "data":
                    maybeFunctions.set(property.name, canBeFunction(context, property.property.value));
                    break;
                case "props": {
                    const types = getComponentPropsTypes(context, property);
                    maybeFunctions.set(property.name, !types || types.some((type) => !NATIVE_NOT_FUNCTION_TYPES.has(type)));
                    break;
                }
                case "computed": {
                    let value = property.property.value;
                    if (value.type === "ObjectExpression") {
                        const getProp = utils.findProperty(value, "get");
                        if (getProp) value = getProp.value;
                    }
                    processFunction(property.name, value, "computed");
                    break;
                }
                case "methods": {
                    const value = property.property.value;
                    processFunction(property.name, value, "methods");
                    maybeFunctions.set(property.name, true);
                    break;
                }
            }
        }
        for (const property of utils.iterateProperties(node, GROUPS)) if (property.type !== "array") collectProperty(property);
        this.maybeFunctions = maybeFunctions;
        this.functions = functions;
        this.callMembers = [];
        this.cacheMaybeFunctionExpressions = new Map();
        function processFunction(name, value, kind) {
            if (value.type === "FunctionExpression") functions.push(new FunctionData(name, kind, value, context));
            else if (value.type === "ArrowFunctionExpression") {
                const data = new FunctionData(name, kind, value, context);
                if (value.expression) data.addReturnValue(value.body);
                functions.push(data);
            }
        }
    }
    /**
    * Adds the given return statement to the return value of the function.
    */
    addReturnStatement(scopeFunction, returnNode) {
        for (const data of this.functions) if (data.node === scopeFunction) {
            data.addReturnValue(returnNode.argument);
            break;
        }
    }
    verifyComponent() {
        for (const call of this.callMembers) this.verifyCallMember(call);
    }
    verifyCallMember(call) {
        const fnData = this.functions.find((data) => data.name === call.name && data.kind === "computed");
        if (!fnData || fnData.maybeReturnFunction(this)) return;
        const prefix = call.node.callee.type === "MemberExpression" ? "this." : "";
        this.context.report({
            node: call.node,
            messageId: "unexpected",
            data: {
                likeProperty: `${prefix}${call.name}`,
                likeMethod: `${prefix}${call.name}()`
            }
        });
    }
    /**
    * Check whether given expression may be a function.
    */
    maybeFunctionExpression(node) {
        const cache = this.cacheMaybeFunctionExpressions.get(node);
        if (cache != null) return cache;
        this.cacheMaybeFunctionExpressions.set(node, true);
        const result = maybeFunctionExpressionWithoutCache.call(this);
        this.cacheMaybeFunctionExpressions.set(node, result);
        return result;
        function maybeFunctionExpressionWithoutCache() {
            for (const expr of resolvedExpressions(this.context, node)) {
                if (!canBeFunction(this.context, expr)) continue;
                if (this.expressionCouldBeFunction(expr)) return true;
            }
            return false;
        }
    }
    /**
    * Check whether the given expression could be a function.
    */
    expressionCouldBeFunction(expr) {
        switch (expr.type) {
            case "MemberExpression":
                if (utils.isThis(expr.object, this.context)) {
                    const name = utils.getStaticPropertyName(expr);
                    if (name && !this.maybeFunctionProperty(name)) return false;
                }
                return true;
            case "CallExpression":
                if (expr.callee.type === "MemberExpression" && utils.isThis(expr.callee.object, this.context)) {
                    const name = utils.getStaticPropertyName(expr.callee);
                    const fnData = this.functions.find((data) => data.name === name);
                    if (fnData && fnData.kind === "methods" && !fnData.maybeReturnFunction(this)) return false;
                }
                return true;
            case "ConditionalExpression": return this.maybeFunctionExpression(expr.consequent) || this.maybeFunctionExpression(expr.alternate);
            default: return true;
        }
    }
    /**
    * Check whether given property name may be a function.
    */
    maybeFunctionProperty(name) {
        const cache = this.maybeFunctions.get(name);
        if (cache != null) return cache;
        this.maybeFunctions.set(name, true);
        const result = maybeFunctionPropertyWithoutCache.call(this);
        this.maybeFunctions.set(name, result);
        return result;
        function maybeFunctionPropertyWithoutCache() {
            const fnData = this.functions.find((data) => data.name === name);
            return fnData && fnData.kind === "computed" ? fnData.maybeReturnFunction(this) : true;
        }
    }
};

export default {
    meta: {
        type: "problem",
        description: 'Do not call Vue computed properties that are not functions.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Use {{ likeProperty }} instead of {{ likeMethod }}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        let scopeStack = null;
        let componentStack = null;
        let templateComponent = null;
        return utils.compositingVisitors({}, utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                componentStack = new ComponentStack(node, context, componentStack);
                if (!templateComponent && utils.isInExportDefault(node)) templateComponent = componentStack;
            },
            onVueObjectExit() {
                if (!componentStack) return;
                componentStack.verifyComponent();
                componentStack = componentStack.upper;
            },
            ":function"(node) {
                scopeStack = {
                    upper: scopeStack,
                    scopeNode: node
                };
            },
            ReturnStatement(node) {
                if (scopeStack && componentStack) componentStack.addReturnStatement(scopeStack.scopeNode, node);
            },
            ":function:exit"() {
                scopeStack &&= scopeStack.upper;
            },
            "ThisExpression, Identifier"(node) {
                if (!componentStack || node.parent.type !== "MemberExpression" || node.parent.object !== node || node.parent.parent.type !== "CallExpression" || node.parent.parent.callee !== node.parent || !utils.isThis(node, context)) return;
                const name = utils.getStaticPropertyName(node.parent);
                if (name) componentStack.callMembers.push({
                    name,
                    node: node.parent.parent
                });
            }
        }), utils.defineTemplateBodyVisitor(context, { VExpressionContainer(node) {
            if (!templateComponent) return;
            for (const ref of node.references) {
                if (ref.variable != null) continue;
                const id = ref.id;
                if (id.parent.type !== "CallExpression" || id.parent.callee !== id) continue;
                templateComponent.verifyCallMember({
                    name: id.name,
                    node: id.parent
                });
            }
        } }));
    },
};
