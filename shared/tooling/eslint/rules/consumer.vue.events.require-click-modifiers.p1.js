// A click listener must explicitly choose its event behavior.
// Modifier validity is owned by the v-on validity rule; never invent a modifier.
export default {
    meta: {
        type: "suggestion",
        description: 'Choose an intentional modifier for each statically named click listener.',
        includeInReadme: true,
        schema: [],
        messages: {
            modifier: "Add an intentional modifier to this click listener, such as .exact, .stop, or .prevent. Choose the behavior required by this element or component; preserve the handler and do not use deprecated modifiers.",
        },
    },
    create(context) {
        const services = context.sourceCode.parserServices;
        if (!services.defineTemplateBodyVisitor) return {};
        return services.defineTemplateBodyVisitor({
            "VAttribute[directive=true][key.name.name='on']"(node) {
                if (node.key.argument?.type !== "VIdentifier" || node.key.argument.name !== "click" || node.key.modifiers.length) return;
                context.report({ node: node.key, messageId: "modifier" });
            },
        });
    },
};
