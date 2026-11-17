// Separate the defineEmits declaration even when neighboring statements
// are also const declarations. Unrelated local functions are not Vue macros.
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import {createVueScriptSpacingVisitor} from '#eslint/helpers/create-vue-script-spacing-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate top-level defineEmits declarations from neighboring statements with blank lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line {{position}} this const emit declaration. Preserve attached comments and do not add padding against script tags.',
            manual: 'Add a blank line {{position}} this const emit declaration manually, preserving line-sensitive directives and their target statements.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return createVueScriptSpacingVisitor(context, (statement) => {
            if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return false;
            return statement.declarations.some((declaration) => {
                const call = unwrapExpression(declaration.init);
                if (call?.type !== 'CallExpression' || call.optional) return false;
                const callee = unwrapExpression(call.callee);
                if (callee?.type === 'Identifier' && callee.name === 'defineEmits' && !resolveVariableBinding(callee, sourceCode)?.defs.length) return true;
                const binding = resolveImportOrigin(callee, sourceCode);
                return binding?.source === 'vue' && binding.name === 'defineEmits';
            });
        });
    },
};
