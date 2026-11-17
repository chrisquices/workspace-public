import require_vue3_export_names from "eslint-plugin-vue/dist/utils/vue3-export-names.js";
const vue3ExportNames = new Set(require_vue3_export_names.default);
const TARGET_AT_VUE_MODULES = new Set([
    "@vue/runtime-dom",
    "@vue/runtime-core",
    "@vue/reactivity",
    "@vue/shared"
]);
function* extractSpecifierNames(specifier) {
    switch (specifier.type) {
        case "ImportDefaultSpecifier":
            yield "default";
            break;
        case "ImportNamespaceSpecifier":
            yield null;
            break;
        case "ImportSpecifier": yield specifier.imported.name;
    }
}
function* extractImportNames(node) {
    for (const specifier of node.specifiers) yield* extractSpecifierNames(specifier);
}

export default {
    meta: {
        type: "suggestion",
        description: 'Import public Vue APIs from vue instead of internal Vue packages.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "importedAtVue": "Import from 'vue' instead of '{{source}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const declaration = target?.parent;
                if (!declaration?.specifiers?.length || !["ImportDeclaration", "ExportNamedDeclaration"].includes(declaration.type)) return null;
                if (declaration.specifiers.some(function (specifier) { return !["ImportSpecifier", "ExportSpecifier"].includes(specifier.type); })) return null;
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

        /**
        * `names` are the named bindings imported or exported from the source.
        */
        function verifySource(source, isFixable, names) {
            if (!TARGET_AT_VUE_MODULES.has(source.value) || names.length > 0 && names.every((name) => !vue3ExportNames.has(name))) return;
            context.report({
                node: source,
                data: { source: source.value },
                fix: safeFix(source, isFixable() ? (fixer) => fixer.replaceTextRange([source.range[0] + 1, source.range[1] - 1], "vue") : null),
                messageId: "importedAtVue"
            });
        }
        return {
            ImportDeclaration(node) {
                if (node.specifiers.length === 0 && context.filename.endsWith(".d.ts")) return;
                const importedNames = node.specifiers.every((specifier) => specifier.type === "ImportSpecifier") ? node.specifiers.map((specifier) => specifier.imported.name) : [];
                verifySource(node.source, () => {
                    for (const name of extractImportNames(node)) if (name == null || !vue3ExportNames.has(name)) return false;
                    return true;
                }, importedNames);
            },
            ExportNamedDeclaration(node) {
                if (node.source) verifySource(node.source, () => {
                    for (const specifier of node.specifiers) if (!vue3ExportNames.has(specifier.local.name)) return false;
                    return true;
                }, node.specifiers.map((specifier) => specifier.local.name));
            },
            ExportAllDeclaration(node) {
                verifySource(node.source, () => false, []);
            }
        };
    },
};
