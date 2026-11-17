import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import require_index from "eslint-plugin-vue/dist/utils/ts-utils/index.js";
import vueUtilities from "eslint-plugin-vue/dist/utils/index.js";
import require_ref_object_references from "eslint-plugin-vue/dist/utils/ref-object-references.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = vueUtilities.default;
const import_ts_utils = { default: require_index.default };
function isRefInit(data) {
    const init = data && data.variableDeclarator && data.variableDeclarator.init;
    return init ? data.defineChain.includes(init) : false;
}
function getNameParamNode(node) {
    const nameLiteralNode = node.arguments[0];
    if (nameLiteralNode && utils.isStringLiteral(nameLiteralNode)) {
        const name = utils.getStringLiteralValue(nameLiteralNode);
        if (name != null) return {
            name,
            loc: nameLiteralNode.loc
        };
    }
    return null;
}
function getCalleeMemberNode(node) {
    const callee = utils.skipChainExpression(node.callee);
    if (callee.type === "MemberExpression") {
        const name = utils.getStaticPropertyName(callee);
        if (name) return {
            name,
            member: callee
        };
    }
    return null;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use .value when reading or writing refs in scripts.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "requireDotValue": "Must use `.value` to read or write the value wrapped by `{{method}}()`." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "requireDotValueOfRef": "Must use `.value` to read or write the value of a ref." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const parent = target?.parent;
                if (parent?.type === "CallExpression") return null;
                const writes = parent?.type === "UpdateExpression" || (parent?.type === "AssignmentExpression" && parent.left === target);
                if (writes) {
                    const definition = resolveVariableBinding(target, sourceForFixes)?.defs?.find(function (item) { return item.type === "Variable"; });
                    const init = unwrapExpression(definition?.node.init);
                    const binding = init?.type === "CallExpression" ? resolveImportOrigin(init.callee, sourceForFixes) : null;
                    if (binding?.source !== "vue" || !["ref", "shallowRef"].includes(binding.name)) return null;
                }
                const result = change(fixer);
                if (!result) return null;
                const edits = result.range ? [result] : [...result];
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);

                    for (const comment of commentsForFixes) {
                        if (edit.range[0] < comment.range[1] && edit.range[1] > comment.range[0]
                            && !edit.text.includes(sourceForFixes.getText(comment))) return null;
                        if (/eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(comment.value)
                            && /[\r\n]/u.test(before + edit.text)) {
                            const first = sourceForFixes.getLocFromIndex(edit.range[0]).line;
                            const last = sourceForFixes.getLocFromIndex(edit.range[1]).line;
                            if (first <= comment.loc.end.line + 1 && last >= comment.loc.start.line - 1) return null;
                        }
                    }
                }
                return edits;
            };
        }

        let refReferences;
        const setupContexts = new Map();
        /**
        * Collect identifier id
        */
        function collectReferenceIds(node, referenceIds) {
            const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
            if (!variable) return;
            for (const reference of variable.references) referenceIds.add(reference.identifier);
        }
        function reportIfRefWrapped(node, shouldCheckType = true) {
            const data = refReferences.get(node);
            if (isRefInit(data)) context.report({
                node,
                data: { method: data.method },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(node, ".value");
                }),
                messageId: "requireDotValue"
            });
            else if (shouldCheckType && import_ts_utils.default.isRefObjectType(context, node)) context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(node, ".value");
                }),
                messageId: "requireDotValueOfRef"
            });
        }
        function reportWrappedIdentifiers(node) {
            const nodes = node.arguments.filter((node) => node.type === "Identifier");
            for (const node of nodes) reportIfRefWrapped(node);
        }
        const programNode = context.sourceCode.ast;
        const callVisitor = { CallExpression(node, info) {
            if (!getNameParamNode(node)) return;
            const setupContext = setupContexts.get(info ? info.node : programNode);
            if (!setupContext) return;
            const { contextReferenceIds, emitReferenceIds } = setupContext;
            if (node.callee.type === "Identifier" && emitReferenceIds.has(node.callee)) reportWrappedIdentifiers(node);
            else {
                const emit = getCalleeMemberNode(node);
                if (emit && emit.name === "emit" && emit.member.object.type === "Identifier" && contextReferenceIds.has(emit.member.object)) reportWrappedIdentifiers(node);
            }
        } };
        return utils.compositingVisitors({
            Program() {
                refReferences = require_ref_object_references.extractRefObjectReferences(context);
            },
            "IfStatement>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "SwitchStatement>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "UnaryExpression>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "UpdateExpression>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "BinaryExpression>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "AssignmentExpression>Identifier"(node) {
                if (node.parent.operator === "=") {
                    if (node.parent.left !== node) return;
                    reportIfRefWrapped(node, false);
                    return;
                }
                reportIfRefWrapped(node);
            },
            "LogicalExpression>Identifier"(node) {
                if (node.parent.left !== node) return;
                const data = refReferences.get(node);
                if (!data || !data.variableDeclaration || data.variableDeclaration.kind !== "const") return;
                reportIfRefWrapped(node);
            },
            "ConditionalExpression>Identifier"(node) {
                if (node.parent.test !== node) return;
                reportIfRefWrapped(node);
            },
            ":not(TaggedTemplateExpression)>TemplateLiteral>Identifier"(node) {
                reportIfRefWrapped(node);
            },
            "MemberExpression>Identifier"(node) {
                if (node.parent.object !== node) return;
                const name = utils.getStaticPropertyName(node.parent);
                if (name === "value" || name === "effect" || name == null) return;
                reportIfRefWrapped(node);
            }
        }, utils.defineScriptSetupVisitor(context, {
            onDefineEmitsEnter(node) {
                if (!node.parent || node.parent.type !== "VariableDeclarator" || node.parent.init !== node) return;
                const emitParam = node.parent.id;
                if (emitParam.type !== "Identifier") return;
                const emitReferenceIds = new Set();
                collectReferenceIds(emitParam, emitReferenceIds);
                setupContexts.set(programNode, {
                    contextReferenceIds: new Set(),
                    emitReferenceIds
                });
            },
            ...callVisitor
        }), utils.defineVueVisitor(context, {
            onSetupFunctionEnter(node, { node: vueNode }) {
                const contextParam = utils.skipDefaultParamValue(node.params[1]);
                if (!contextParam || contextParam.type === "RestElement" || contextParam.type === "ArrayPattern") return;
                const contextReferenceIds = new Set();
                const emitReferenceIds = new Set();
                if (contextParam.type === "ObjectPattern") {
                    const emitProperty = utils.findAssignmentProperty(contextParam, "emit");
                    if (!emitProperty || emitProperty.value.type !== "Identifier") return;
                    collectReferenceIds(emitProperty.value, emitReferenceIds);
                } else collectReferenceIds(contextParam, contextReferenceIds);
                setupContexts.set(vueNode, {
                    contextReferenceIds,
                    emitReferenceIds
                });
            },
            ...callVisitor,
            onVueObjectExit(node) {
                setupContexts.delete(node);
            }
        }));
    },
};
