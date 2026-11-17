// Isolate the top-level defineExpose macro, including beside other calls.
// Only compare statements in the same script setup block: never pad script
// boundaries or match local functions/methods named defineExpose.
// Preserve comment ownership and leave line-sensitive moves for manual repair.
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import {createVueScriptSpacingVisitor} from '#eslint/helpers/create-vue-script-spacing-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate top-level defineExpose calls from neighboring statements with blank lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line {{position}} defineExpose(). Keep leading documentation and trailing comments attached to their statements; do not add padding against script tags.',
            manual: 'Add a blank line {{position}} defineExpose() manually, preserving line-sensitive directives and their target statements.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return createVueScriptSpacingVisitor(context, (statement) => {
            if (statement.type !== 'ExpressionStatement') return false;
            const expression = unwrapExpression(statement.expression);
            if (expression?.type !== 'CallExpression' || expression.optional) return false;
            const callee = expression.callee;
            if (callee.type !== 'Identifier' || callee.name !== 'defineExpose') return false;
            return !resolveVariableBinding(callee, sourceCode)?.defs.length;
        });
    },
};
