import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveImportOrigin } from './resolve-import-origin.js';

const sharedCore = fileURLToPath(new URL('../../../packages/js/ui-engines/shared/core.ts', import.meta.url));

export function isSharedErrorReporterFactory(expression, context) {
    const origin = resolveImportOrigin(expression, context.sourceCode);
    if (origin?.name !== 'createErrorReporter') return false;
    if (origin.source === 'workspace-packages/ui-engines/shared/core') return true;

    return origin.source.startsWith('.')
        && [sharedCore, sharedCore.slice(0, -3), sharedCore.slice(0, -3) + '.js']
            .includes(resolve(dirname(context.filename), origin.source));
}
