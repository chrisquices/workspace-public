import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: "Keep Vue templates with src free of inline content.",
        includeInReadme: true,
        schema: [],
        messages: {
            "emptySrc": "A template with src cannot also contain inline content. Move the intended content to the external template or remove src, preserving the rendered behavior."
        },
    },
    create(context) {

        const sourceCode = context.sourceCode;
        return { Program(program) {
            const element = program.templateBody;
            if (element == null) return;
            const hasSrc = utils.hasAttribute(element, "src");
            const rootElements = [];
            for (const child of element.children) if (sourceCode.getText(child).trim() !== "") rootElements.push(child);
            if (hasSrc && rootElements.length > 0) for (const element of rootElements) context.report({
                node: element,
                loc: element.loc,
                messageId: "emptySrc"
            });
        } };
    },
};
