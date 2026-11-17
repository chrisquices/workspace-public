import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isWhitespaceTextNode(node) {
    return node.type === "VText" && node.value.trim() === "";
}
function comparePositions(pos1, pos2) {
    if (pos1.line < pos2.line || pos1.line === pos2.line && pos1.column < pos2.column) return "less";
    return pos1.line > pos2.line || pos1.line === pos2.line && pos1.column > pos2.column ? "greater" : "equal";
}
function getLocationRange(nodes) {
    let start;
    let end;
    for (const node of nodes) {
        if (!start || comparePositions(node.loc.start, start) === "less") start = node.loc.start;
        if (!end || comparePositions(node.loc.end, end) === "greater") end = node.loc.end;
    }
    return start === void 0 || end === void 0 ? void 0 : {
        start,
        end
    };
}

export default {
    meta: {
        type: "problem",
        description: 'Do not place child content inside elements using v-text or v-html.',
        includeInReadme: true,
        schema: [],
        messages: {
            "disallowedChildContent": "Child content is disallowed because it will be overwritten by the v-{{ directiveName }} directive." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "removeChildContent": "Remove child content." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const directives = new Set(["html", "text"]);
        const option = ruleOptions[0];
        if (option !== void 0) for (const directive of option.additionalDirectives) directives.add(directive);
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true]"(directiveNode) {
            const directiveName = directiveNode.key.name.name;
            const elementNode = directiveNode.parent.parent;
            if (elementNode.endTag === null || !directives.has(directiveName)) return;
            const elementComments = context.sourceCode.parserServices.getTemplateBodyTokenStore().getTokensBetween(elementNode.startTag, elementNode.endTag, {
                includeComments: true,
                filter: (token) => token.type === "HTMLComment"
            });
            const childNodes = [...elementNode.children, ...elementComments];
            if (childNodes.some((childNode) => !isWhitespaceTextNode(childNode))) context.report({
                node: elementNode,
                loc: getLocationRange(childNodes),
                data: { directiveName },
                messageId: "disallowedChildContent"
            });
        } });
    },
};
