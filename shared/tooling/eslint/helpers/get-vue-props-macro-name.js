import { resolveImportOrigin } from './resolve-import-origin.js';
import { resolveVariableBinding } from './resolve-variable-binding.js';
import { unwrapExpression } from './unwrap-expression.js';

const macroNames = new Set(['defineProps', 'withDefaults']);

export function getVuePropsMacroName(expression, sourceCode) {
    const callee = unwrapExpression(expression);

    if (callee?.type === 'Identifier' && macroNames.has(callee.name) && !resolveVariableBinding(callee, sourceCode)?.defs.length) {
        return callee.name;
    }

    const binding = resolveImportOrigin(callee, sourceCode);

    return binding?.source === 'vue' && macroNames.has(binding.name) ? binding.name : null;
}
