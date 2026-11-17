import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import html from '@html-eslint/eslint-plugin';
import globals from 'globals';
import ts from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const workspaceDirectory = fileURLToPath(new URL('../../../', import.meta.url));
const rulesDirectory = fileURLToPath(new URL('./rules/', import.meta.url));
const engineDirectory = fileURLToPath(new URL('../../packages/js/ui-engines/', import.meta.url));
const engineProject = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
const sourceExtensions = '{js,mjs,cjs,ts,mts,cts,vue}';
const scripts = `**/*.${sourceExtensions}`;
const consumers = `apps/**/*.${sourceExtensions}`;
const ruleMetadata = {};
const rules = {};
const entries = [];
const names = new Set();

function filesFor(name) {
    if (name.startsWith('rules.eslint.')) return ['shared/tooling/eslint/rules/*.js'];
    if (name.startsWith('provider.ui-engines.')) return ['shared/packages/js/ui-engines/**/*.{js,mjs,cjs,ts,mts,cts}'];
    if (name.startsWith('general.html.')) return ['**/*.html'];
    if (name.startsWith('general.vue.')) return ['**/*.vue'];
    if (/^general\.(js|regions|comments|files)\./u.test(name)) return [scripts];
    if (/^consumer\.(vue|ui)\./u.test(name)) return ['apps/**/*.vue'];
    if (/^consumer\.inertia\.(head|links)\./u.test(name)) return ['apps/**/*.vue'];
    if (/^consumer\.(js|ui-engines|inertia-helper)\./u.test(name) || name.startsWith('consumer.inertia.requests.')) return [consumers];
    throw new Error(`No file scope is configured for ESLint rule ${name}.`);
}

for (const filename of (await readdir(rulesDirectory)).filter((name) => name.endsWith('.js')).sort()) {
    const match = /^(.*)\.p(\d+)\.js$/u.exec(filename);
    if (!match || !Number.isSafeInteger(Number(match[2]))) throw new Error(`Invalid ESLint rule filename: ${filename}`);
    const [, name, priorityText] = match;
    if (names.has(name)) throw new Error(`Duplicate ESLint rule name: ${name}`);
    names.add(name);
    const path = resolve(rulesDirectory, filename);
    const module = await import(pathToFileURL(path).href);
    const rule = module.default;
    if (typeof rule?.create !== 'function') throw new TypeError(`${filename} must default-export a rule with a create function.`);
    rules[name] = rule;
    ruleMetadata[path] = {
        description: rule.meta?.description,
        messageIds: Object.keys(rule.meta?.messages ?? {}),
        exports: Object.keys(module),
    };
    entries.push({ name, priority: Number(priorityText), files: filesFor(name) });
}

export const priorities = [...new Set(entries.map((entry) => entry.priority))].sort((a, b) => a - b);

export function createPassConfig(priority) {
    return [
        { ignores: ['**/node_modules/**', '**/vendor/**', '**/public/build/**', '**/bootstrap/**', '**/storage/**', '**/resources/js/actions/**', '**/resources/js/routes/**', '**/resources/js/wayfinder/**'] },
        { plugins: { workspace: { rules }, html }, settings: { workspaceRuleMetadata: ruleMetadata } },
        { basePath: workspaceDirectory, files: ['**/*.{js,mjs,cjs}'], languageOptions: { globals: globals.node } },
        { basePath: workspaceDirectory, files: ['**/*.{ts,mts,cts}'], languageOptions: { parser: ts.parser } },
        { basePath: workspaceDirectory, files: ['**/*.vue'], languageOptions: { parser: vueParser, parserOptions: { parser: ts.parser } } },
        { basePath: workspaceDirectory, files: ['**/*.html'], language: 'html/html' },
        { basePath: engineDirectory, files: ['**/*.{js,mjs,cjs,ts,mts,cts}'], languageOptions: { parser: ts.parser, parserOptions: { project: engineProject } } },
        ...entries.filter((entry) => priority === undefined || entry.priority === priority).map((entry) => ({
            basePath: workspaceDirectory,
            files: entry.files,
            rules: { [`workspace/${entry.name}`]: 'error' },
        })),
    ];
}

export default createPassConfig();
