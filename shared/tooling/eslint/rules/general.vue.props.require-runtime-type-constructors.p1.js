import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const forbiddenTypes = new Set([
    "Literal",
    "TemplateLiteral",
    "BinaryExpression",
    "UpdateExpression"
]);
function isForbiddenType(node) {
    return forbiddenTypes.has(node.type) && !(node.type === "Literal" && node.value == null && !node.bigint);
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use constructors for runtime Vue prop types.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "propTypeConstructor": "The \"{{name}}\" property should be a constructor." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const name = target?.type === "Literal" ? target.value : target?.type === "TemplateLiteral" && target.expressions.length === 0 ? target.quasis[0].value.cooked : null;
                if (!["String", "Number", "Boolean", "Object", "Array", "Function", "Symbol", "BigInt"].includes(name)) return null;
                for (let scope = sourceForFixes.getScope(target); scope; scope = scope.upper) {
                    if (scope.set.get(name)?.defs?.length) return null;
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

        function checkPropertyNode(propName, node) {
            const nodes = node.type === "ArrayExpression" ? node.elements.filter(utils.isDef) : [node];
            for (const prop of nodes) {
                if (!isForbiddenType(prop)) continue;
                context.report({
                    node: prop,
                    data: { name: propName },
                    fix: safeFix(prop, (fixer) => {
                        if (prop.type === "Literal" || prop.type === "TemplateLiteral") {
                            const newText = utils.getStringLiteralValue(prop, true);
                            if (newText) return fixer.replaceText(prop, newText);
                        }
                        return null;
                    }),
                    messageId: "propTypeConstructor"
                });
            }
        }
        function verifyProps(props) {
            for (const prop of props) {
                if (prop.type !== "object" || prop.propName == null) continue;
                if (isForbiddenType(prop.value) || prop.value.type === "ArrayExpression") checkPropertyNode(prop.propName, prop.value);
                else if (prop.value.type === "ObjectExpression") {
                    const typeProperty = utils.findProperty(prop.value, "type");
                    if (!typeProperty) continue;
                    checkPropertyNode(prop.propName, typeProperty.value);
                }
            }
        }
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, { onDefinePropsEnter(_node, props) {
            verifyProps(props);
        } }), utils.executeOnVueComponent(context, (obj) => {
            verifyProps(utils.getComponentPropsFromOptions(obj));
        }));
    },
};
