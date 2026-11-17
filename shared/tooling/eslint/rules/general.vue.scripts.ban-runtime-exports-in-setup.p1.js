import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use runtime exports inside Vue script setup blocks.',
        includeInReadme: true,
        schema: [],
        messages: {
            "forbidden": "Remove the runtime export from script setup. If it must be exported, move it to an appropriate module or normal script block, preserving references and behavior."
        },
    },
    create(context) {

        function verify(node, loc) {
            const tsNode = node;
            if (tsNode.exportKind === "type" || tsNode.type === "ExportNamedDeclaration" && tsNode.specifiers.length > 0 && tsNode.specifiers.every((spec) => spec.exportKind === "type")) return;
            context.report({
                node,
                loc,
                messageId: "forbidden"
            });
        }
        return utils.defineScriptSetupVisitor(context, {
            ExportAllDeclaration: (node) => verify(node, node.loc),
            ExportDefaultDeclaration: (node) => verify(node, node.loc),
            ExportNamedDeclaration: (node) => {
                verify(node, node.declaration ? context.sourceCode.getFirstToken(node).loc : node.loc);
            }
        });
    },
};
