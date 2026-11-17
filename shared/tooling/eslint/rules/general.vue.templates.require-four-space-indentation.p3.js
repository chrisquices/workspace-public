// Reuse the installed Vue token-offset helper, not a native rule/preset.
import vueUtilities from "eslint-plugin-vue/dist/utils/index.js";
import indentation from "eslint-plugin-vue/dist/utils/indent-common.js";

export default {
    meta: {
        type: "layout",
        description: 'Indent Vue template contents using four spaces per level.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            character: "Use {{expected}} indentation characters instead of {{actual}}. Preserve the template content.",
            indent: "Indent this line by {{expectedIndent}} spaces instead of {{actualIndent}}. Preserve literal and preformatted content.",
        },
    },
    create(context) {
        const source = context.sourceCode;
        const services = source.parserServices;
        if (!services.getTemplateBodyTokenStore || !services.defineTemplateBodyVisitor) return {};
        const helperContext = Object.create(context);
        Object.defineProperties(helperContext, {
            options: { value: [4, { attribute: 1, baseIndent: 1, closeBracket: 0, alignAttributesVertically: true }] },
            report: { value: function (descriptor) {
                const { loc, data, fix } = descriptor;
                context.report({
                    loc: loc,
                    data: data,
                    messageId: data.expectedIndent === undefined ? "character" : "indent",
                    fix: fix,
                });
            } },
        });
        const visitor = indentation.defineVisitor(helperContext, services.getTemplateBodyTokenStore(), { baseIndent: 1 });
        return vueUtilities.default.defineTemplateBodyVisitor(context, visitor);
    },
};
