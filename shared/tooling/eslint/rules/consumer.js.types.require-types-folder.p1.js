// App type aliases and interfaces belong under a directory named exactly types.
// Any ancestor directory may provide that boundary; filenames and deeper folders
// are unrestricted. Inline annotations and defineProps types remain allowed.
// Moving declarations requires choosing exports/imports and preserving generic
// dependencies, so placement is reported without an automatic rewrite.

export default {
    meta: {
        type: 'suggestion',
        description: 'Place app type aliases and interfaces under a types directory.',
        includeInReadme: true,
        schema: [],
        messages: {
            placement: 'Move {{name}} into a file under a directory named types, then import it where needed. The types directory may be anywhere and the filename is unrestricted. Preserve generic parameters, dependencies, exports, and references. Shared packages may keep local types; this rule applies only to apps.',
        },
    },

    create(context) {
        const directories = context.filename.split(/[\\/]/u).slice(0, -1);

        if (directories.includes('types')) {
            return {};
        }

        function report(node) {
            context.report({
                node: node,
                messageId: 'placement',
                data: { name: node.id.name },
            });
        }

        return {
            TSTypeAliasDeclaration: report,
            TSInterfaceDeclaration: report,
        };
    },
};
