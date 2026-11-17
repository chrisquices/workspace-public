import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const FIX_EMITS_AFTER_OPTIONS = new Set([
    "setup",
    "data",
    "computed",
    "watch",
    "methods",
    "template",
    "render",
    "renderError",
    "beforeCreate",
    "created",
    "beforeMount",
    "mounted",
    "beforeUpdate",
    "updated",
    "activated",
    "deactivated",
    "beforeUnmount",
    "unmounted",
    "beforeDestroy",
    "destroyed",
    "renderTracked",
    "renderTriggered",
    "errorCaptured"
]);
function buildSuggest(define, emits, nameWithLoc, context) {
    const emitsKind = define.type === "ObjectExpression" ? "`emits` option" : "`defineEmits`";
    const lastEmit = emits.filter((e) => e.type === "array" || e.type === "object").at(-1);
    if (lastEmit) return [{
        messageId: "addOneOption",
        data: {
            name: nameWithLoc.name,
            emitsKind
        },
        fix(fixer) {
            if (lastEmit.type === "array") return fixer.insertTextAfter(lastEmit.node, `, '${nameWithLoc.name}'`);
            return lastEmit.type === "object" ? fixer.insertTextAfter(lastEmit.node, `, '${nameWithLoc.name}': null`) : null;
        }
    }];
    if (define.type !== "ObjectExpression") return [];
    const object = define;
    const propertyNodes = object.properties.filter(utils.isProperty);
    const emitsOption = propertyNodes.find((p) => utils.getStaticPropertyName(p) === "emits");
    if (emitsOption) {
        const sourceCode = context.sourceCode;
        const emitsOptionValue = emitsOption.value;
        if (emitsOptionValue.type === "ArrayExpression") {
            const leftBracket = sourceCode.getFirstToken(emitsOptionValue, _eslint_community_eslint_utils.isOpeningBracketToken);
            return [{
                messageId: "addOneOption",
                data: {
                    name: nameWithLoc.name,
                    emitsKind
                },
                fix(fixer) {
                    return fixer.insertTextAfter(leftBracket, `'${nameWithLoc.name}'${emitsOptionValue.elements.length > 0 ? "," : ""}`);
                }
            }];
        }
        if (emitsOptionValue.type === "ObjectExpression") {
            const leftBrace = sourceCode.getFirstToken(emitsOptionValue, _eslint_community_eslint_utils.isOpeningBraceToken);
            return [{
                messageId: "addOneOption",
                data: {
                    name: nameWithLoc.name,
                    emitsKind
                },
                fix(fixer) {
                    return fixer.insertTextAfter(leftBrace, `'${nameWithLoc.name}': null${emitsOptionValue.properties.length > 0 ? "," : ""}`);
                }
            }];
        }
        return [];
    }
    const sourceCode = context.sourceCode;
    const afterOptionNode = propertyNodes.find((p) => FIX_EMITS_AFTER_OPTIONS.has(utils.getStaticPropertyName(p) || ""));
    return [{
        messageId: "addArrayEmitsOption",
        data: {
            name: nameWithLoc.name,
            emitsKind
        },
        fix(fixer) {
            if (afterOptionNode) return fixer.insertTextAfter(sourceCode.getTokenBefore(afterOptionNode), `\nemits: ['${nameWithLoc.name}'],`);
            const lastPropertyNode = object.properties.at(-1);
            if (lastPropertyNode) {
                const before = propertyNodes.at(-1) || lastPropertyNode;
                return fixer.insertTextAfter(before, `,\nemits: ['${nameWithLoc.name}']`);
            }
            const objectLeftBrace = sourceCode.getFirstToken(object, _eslint_community_eslint_utils.isOpeningBraceToken);
            const objectRightBrace = sourceCode.getLastToken(object, _eslint_community_eslint_utils.isClosingBraceToken);
            return fixer.insertTextAfter(objectLeftBrace, `\nemits: ['${nameWithLoc.name}']${objectLeftBrace.loc.end.line < objectRightBrace.loc.start.line ? "" : "\n"}`);
        }
    }, {
        messageId: "addObjectEmitsOption",
        data: {
            name: nameWithLoc.name,
            emitsKind
        },
        fix(fixer) {
            if (afterOptionNode) return fixer.insertTextAfter(sourceCode.getTokenBefore(afterOptionNode), `\nemits: {'${nameWithLoc.name}': null},`);
            const lastPropertyNode = object.properties.at(-1);
            if (lastPropertyNode) {
                const before = propertyNodes.at(-1) || lastPropertyNode;
                return fixer.insertTextAfter(before, `,\nemits: {'${nameWithLoc.name}': null}`);
            }
            const objectLeftBrace = sourceCode.getFirstToken(object, _eslint_community_eslint_utils.isOpeningBraceToken);
            const objectRightBrace = sourceCode.getLastToken(object, _eslint_community_eslint_utils.isClosingBraceToken);
            return fixer.insertTextAfter(objectLeftBrace, `\nemits: {'${nameWithLoc.name}': null}${objectLeftBrace.loc.end.line < objectRightBrace.loc.start.line ? "" : "\n"}`);
        }
    }];
}

export default {
    meta: {
        type: "suggestion",
        description: 'Declare emitted Vue events and their payloads.',
        includeInReadme: true,
        schema: [],
        messages: {
            "missing": "The \"{{name}}\" event has been triggered but not declared on {{emitsKind}}." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "addOneOption": "Add the \"{{name}}\" to {{emitsKind}}." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "addArrayEmitsOption": "Add the {{emitsKind}} with array syntax and define \"{{name}}\" event." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "addObjectEmitsOption": "Add the {{emitsKind}} with object syntax and define \"{{name}}\" event." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowProps":false,"ignoreMixins":false}];

        const options = ruleOptions[0] || {};
        const shouldAllowProps = Boolean(options.allowProps);
        const shouldIgnoreMixins = Boolean(options.ignoreMixins);
        const setupContexts = new Map();
        const vueEmitsDeclarations = new Map();
        const vuePropsDeclarations = new Map();
        let emitParamName = "";
        let vueTemplateDefineData = null;
        function verifyEmit(emits, props, nameWithLoc, vueDefineNode) {
            const name = nameWithLoc.name;
            if (emits.some((e) => e.emitName === name || e.emitName == null)) return;
            if (shouldAllowProps) {
                const key = `on${require_casing.capitalize(name)}`;
                if (props.some((e) => e.propName === key || e.propName == null)) return;
            }
            context.report({
                loc: nameWithLoc.loc,
                data: {
                    name,
                    emitsKind: vueDefineNode.type === "ObjectExpression" ? "`emits` option" : "`defineEmits`"
                },
                messageId: "missing"
            });
        }
        const programNode = context.sourceCode.ast;
        if (utils.isScriptSetup(context)) vueTemplateDefineData = {
            type: "setup",
            define: programNode,
            emits: [],
            props: []
        };
        const callVisitor = { CallExpression(node, info) {
            const callee = utils.skipChainExpression(node.callee);
            const nameWithLoc = utils.getNameParamNode(node);
            if (!nameWithLoc) return;
            const vueDefineNode = info ? info.node : programNode;
            const emitsDeclarations = vueEmitsDeclarations.get(vueDefineNode);
            if (!emitsDeclarations) return;
            let emit;
            if (callee.type === "MemberExpression") {
                const name = utils.getStaticPropertyName(callee);
                if (name === "emit" || name === "$emit") emit = {
                    name,
                    member: callee
                };
            }
            const setupContext = setupContexts.get(vueDefineNode);
            if (setupContext) {
                const { contextReferenceIds, emitReferenceIds } = setupContext;
                if (callee.type === "Identifier" && emitReferenceIds.has(callee)) verifyEmit(emitsDeclarations, vuePropsDeclarations.get(vueDefineNode) || [], nameWithLoc, vueDefineNode);
                else if (emit && emit.name === "emit") {
                    const memObject = utils.skipChainExpression(emit.member.object);
                    if (memObject.type === "Identifier" && contextReferenceIds.has(memObject)) verifyEmit(emitsDeclarations, vuePropsDeclarations.get(vueDefineNode) || [], nameWithLoc, vueDefineNode);
                }
            }
            if (!emit || emit.name !== "$emit") return;
            const memObject = utils.skipChainExpression(emit.member.object);
            if (utils.isThis(memObject, context)) verifyEmit(emitsDeclarations, vuePropsDeclarations.get(vueDefineNode) || [], nameWithLoc, vueDefineNode);
        } };
        return utils.defineTemplateBodyVisitor(context, { CallExpression(node) {
            const callee = utils.skipChainExpression(node.callee);
            const nameWithLoc = utils.getNameParamNode(node);
            if (!nameWithLoc || !vueTemplateDefineData) return;
            if (callee.type === "Identifier" && (callee.name === "$emit" || callee.name === emitParamName)) verifyEmit(vueTemplateDefineData.emits, vueTemplateDefineData.props, nameWithLoc, vueTemplateDefineData.define);
        } }, utils.compositingVisitors(utils.defineScriptSetupVisitor(context, {
            onDefineEmitsEnter(node, emits) {
                vueEmitsDeclarations.set(programNode, emits);
                if (vueTemplateDefineData && vueTemplateDefineData.type === "setup") {
                    vueTemplateDefineData.emits = emits;
                    vueTemplateDefineData.defineEmits = node;
                }
                if (!node.parent || node.parent.type !== "VariableDeclarator" || node.parent.init !== node) return;
                const emitParam = node.parent.id;
                if (emitParam.type !== "Identifier") return;
                emitParamName = emitParam.name;
                const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, emitParam), emitParam);
                if (!variable) return;
                const emitReferenceIds = new Set();
                for (const reference of variable.references) {
                    if (!reference.isRead()) continue;
                    emitReferenceIds.add(reference.identifier);
                }
                setupContexts.set(programNode, {
                    contextReferenceIds: new Set(),
                    emitReferenceIds
                });
            },
            onDefinePropsEnter(_node, props) {
                if (!shouldAllowProps) return;
                vuePropsDeclarations.set(programNode, props);
                if (vueTemplateDefineData && vueTemplateDefineData.type === "setup") vueTemplateDefineData.props = props;
            },
            ...callVisitor
        }), utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                if (shouldIgnoreMixins && utils.findProperty(node, "mixins")) return;
                vueEmitsDeclarations.set(node, utils.getComponentEmitsFromOptions(node));
                if (shouldAllowProps) vuePropsDeclarations.set(node, utils.getComponentPropsFromOptions(node));
            },
            onSetupFunctionEnter(node, { node: vueNode }) {
                const contextParam = node.params[1];
                if (!contextParam || contextParam.type === "RestElement" || contextParam.type === "ArrayPattern") return;
                const contextReferenceIds = new Set();
                const emitReferenceIds = new Set();
                if (contextParam.type === "ObjectPattern") {
                    const emitProperty = utils.findAssignmentProperty(contextParam, "emit");
                    if (!emitProperty) return;
                    const emitParam = emitProperty.value;
                    const variable = emitParam.type === "Identifier" ? (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, emitParam), emitParam) : null;
                    if (!variable) return;
                    for (const reference of variable.references) {
                        if (!reference.isRead()) continue;
                        emitReferenceIds.add(reference.identifier);
                    }
                } else if (contextParam.type === "Identifier") {
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, contextParam), contextParam);
                    if (!variable) return;
                    for (const reference of variable.references) {
                        if (!reference.isRead()) continue;
                        contextReferenceIds.add(reference.identifier);
                    }
                }
                setupContexts.set(vueNode, {
                    contextReferenceIds,
                    emitReferenceIds
                });
            },
            ...callVisitor,
            onVueObjectExit(node, { type }) {
                const emits = vueEmitsDeclarations.get(node);
                if (emits && (!vueTemplateDefineData || vueTemplateDefineData.type !== "export" && vueTemplateDefineData.type !== "setup") && (type === "mark" || type === "export" || type === "definition")) vueTemplateDefineData = {
                    type,
                    define: node,
                    emits,
                    props: vuePropsDeclarations.get(node) || []
                };
                setupContexts.delete(node);
                vueEmitsDeclarations.delete(node);
                vuePropsDeclarations.delete(node);
            }
        })));
    },
};
