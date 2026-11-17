import { getVueTemplateRoot } from '#eslint/helpers/get-vue-template-root.js';
import {readFileSync} from 'node:fs';
import {dirname, isAbsolute} from 'node:path';
import {SourceCode} from 'eslint';
import {createTypeScriptImportResolver} from 'eslint-import-resolver-typescript';
import typescript from 'typescript';
import ts from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import {capitalize, camelize} from '@vue/shared';
import { resolveVueTemplateBinding } from '#eslint/helpers/resolve-vue-template-binding.js';

// Resolution belongs to one linted SourceCode, so another fix pass reads fresh files.
// Imported ASTs are used only to identify roots, never to report or fix caller text.
const sources = new WeakMap();

export function registerUiComponentRoots(context) {
    if (sources.has(context.sourceCode)) return;
    sources.set(context.sourceCode, {
        filename: context.physicalFilename ?? context.filename,
        files: new Map(),
        resolvers: new Map(),
        roots: new WeakMap(),
    });
}

function componentImport(sourceCode, node) {
    if (node.type !== 'VElement' || !/[A-Z-]/u.test(node.rawName)) return undefined;
    const document = sourceCode.parserServices.getDocumentFragment?.();
    if (!document?.children.some((child) => child.type === 'VElement' && child.rawName === 'script'
        && child.startTag.attributes.some((attribute) => !attribute.directive && attribute.key.name === 'setup'))) return undefined;

    const names = [...new Set([node.rawName, camelize(node.rawName), capitalize(camelize(node.rawName))])];
    for (const name of names) {
        const variable = resolveVueTemplateBinding(name, node, sourceCode);
        // Slot/v-for locals must not resolve to a shadowed script import.
        if (variable?.kind) return undefined;
        if (!variable) continue;
        const definition = variable.defs?.find((entry) => entry.type === 'ImportBinding');
        if (!definition || definition.node.importKind === 'type' || definition.parent.importKind === 'type') return undefined;
        const specifier = definition.node;
        if (!['ImportDefaultSpecifier', 'ImportSpecifier'].includes(specifier.type)) return undefined;
        return {source: definition.parent.source.value,
            name: specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name ?? specifier.imported.value};
    }
    return undefined;
}

function readComponent(filename, state) {
    if (state.files.has(filename)) return state.files.get(filename);
    let sourceCode;
    try {
        const text = readFileSync(filename, 'utf8');
        const parsed = vueParser.parseForESLint(text, {
            filePath: filename,
            parser: ts.parser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            loc: true,
            range: true,
            tokens: true,
            comment: true,
            eslintScopeManager: true,
            eslintVisitorKeys: true,
        });
        const errors = parsed.services.getDocumentFragment()?.errors ?? [];
        if (!errors.some((error) => error.code !== 'non-void-html-element-start-tag-with-trailing-solidus')) {
            sourceCode = new SourceCode({text, ast: parsed.ast, scopeManager: parsed.scopeManager,
                visitorKeys: parsed.visitorKeys, parserServices: parsed.services});
        }
    } catch {
        // Missing, unreadable, or malformed definitions cannot prove a required child.
    }
    state.files.set(filename, sourceCode);
    return sourceCode;
}

function resolveFile(specifier, filename, state) {
    if (!isAbsolute(filename) || !specifier.endsWith('.vue')) return undefined;
    if (!state.resolvers.has(filename)) {
        const directory = dirname(filename);
        const project = typescript.findConfigFile(directory, typescript.sys.fileExists)
            ?? typescript.findConfigFile(directory, typescript.sys.fileExists, 'jsconfig.json');
        state.resolvers.set(filename, createTypeScriptImportResolver({
            project: project ?? directory,
            extensions: ['.vue'],
            alwaysTryTypes: false,
        }));
    }
    const resolved = state.resolvers.get(filename).resolve(specifier, filename);
    return resolved.found && resolved.path?.endsWith('.vue') ? resolved.path : undefined;
}

export function getImportedVueComponentRoots(sourceCode, node) {
    const state = sources.get(sourceCode);
    if (!state || node.type !== 'VElement') return [];
    if (state.roots.has(node)) return state.roots.get(node);

    const names = [];
    const seen = new Set([state.filename]);
    let currentSource = sourceCode;
    let currentNode = node;
    let filename = state.filename;
    while (true) {
        const binding = componentImport(currentSource, currentNode);
        if (binding?.name !== 'default' || !binding.source.endsWith('.vue')) break;
        const target = resolveFile(binding.source, filename, state);
        if (!target || seen.has(target)) {
            names.length = 0;
            break;
        }
        seen.add(target);
        const imported = readComponent(target, state);
        const root = imported && getVueTemplateRoot(imported);
        if (!root) {
            names.length = 0;
            break;
        }
        names.push(root.rawName);
        currentSource = imported;
        currentNode = root;
        filename = target;
    }
    state.roots.set(node, names);
    return names;
}
