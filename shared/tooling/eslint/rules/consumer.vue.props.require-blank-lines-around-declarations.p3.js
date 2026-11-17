// Separate defineProps declarations from every neighboring statement,
// including other const declarations. Keep withDefaults part of the same declaration.
import { getVuePropsMacroName } from '#eslint/helpers/get-vue-props-macro-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import {createVueScriptSpacingVisitor} from '#eslint/helpers/create-vue-script-spacing-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Put blank lines around top-level const defineProps declarations.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line {{position}} this const props declaration. Preserve attached comments and do not add padding against script tags.',
            manual: 'Add a blank line {{position}} this const props declaration manually, preserving line-sensitive directives and their target statements.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return createVueScriptSpacingVisitor(context, (statement) => {
            if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return false;
            return statement.declarations.some((declaration) => {
                let call = unwrapExpression(declaration.init);
                if (call?.type !== 'CallExpression' || call.optional) return false;
                if (getVuePropsMacroName(call.callee, sourceCode) === 'withDefaults') call = unwrapExpression(call.arguments[0]);
                return call?.type === 'CallExpression' && !call.optional && getVuePropsMacroName(call.callee, sourceCode) === 'defineProps';
            });
        });
    },
};
