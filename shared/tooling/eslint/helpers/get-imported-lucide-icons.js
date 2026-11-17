import { lucideSources, nonIconExports } from './is-imported-lucide-icon.js';

export function getImportedLucideIcons(program) {
    const names = new Set();
    const namespaces = new Set();

    for (const statement of program.body) {
        if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type'
            || !lucideSources.has(statement.source.value)) continue;

        for (const specifier of statement.specifiers) {
            if (specifier.importKind === 'type') continue;

            if (specifier.type === 'ImportNamespaceSpecifier') {
                namespaces.add(specifier.local.name);
            }

            if (specifier.type === 'ImportSpecifier'
                && !nonIconExports.has(specifier.imported.name ?? specifier.imported.value)) {
                names.add(specifier.local.name);
            }
        }
    }

    return {names: names, namespaces: namespaces};
}
