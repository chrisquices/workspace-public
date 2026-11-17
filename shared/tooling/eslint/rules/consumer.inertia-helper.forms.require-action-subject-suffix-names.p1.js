// Openable Inertia Helper forms use action + subject + Dialog or AlertDialog.
// Strip AlertDialog first so its Alert part cannot masquerade as the subject.
// Subjects can contain several camelCase words. Action vocabulary belongs to
// the separate supported-action-keywords rule. Do not infer a name or rename
// references automatically. Unknown/dynamic openable values are not assumed true.
// Selected is not a subject word: use singular/plural nouns for item counts.

import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Name openable Inertia Helper forms with an action, subject, and Dialog or AlertDialog suffix.',
        includeInReadme: true,
        schema: [],
        messages: {
            selected: 'Openable Inertia Helper form "{{name}}" must not contain the subject word Selected. Name the subject itself and use singular or plural to express item count, such as deleteFileAlertDialog or deleteFilesAlertDialog. Rename manually, update all references and the owning region title where appropriate, and avoid binding collisions. Preserve behavior; selection-state objects such as selectedItems are outside this rule.',
            name: 'Openable Inertia Helper form "{{name}}" must use a camelCase action + subject + Dialog or AlertDialog name, such as newFolderDialog, newFolderItemDialog, deleteFolderAlertDialog, or deleteFolderItemAlertDialog. Include a nonempty subject. Use new for creating, edit for editing, delete for deleting, rename for renaming, move for moving, upload for uploading, search for searching, restore for restoring, and purge for purging; ask the developer when the operation falls outside this list or its meaning is unclear. Update all references and match the owning region title to the action and subject without the suffix; preserve behavior and initialization order. Correct manually.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);

        return {
            VariableDeclarator(node) {
                const call = unwrapExpression(node.init);
                if (node.id.type !== 'Identifier' || call?.type !== 'CallExpression') return;

                const factory = resolveImportOrigin(call.callee, sourceCode);
                if (factory?.source !== 'workspace-packages/inertia-helper' || factory.name !== 'useInertiaHelperForm'
                    || call.arguments.length !== 1 || call.arguments[0].type === 'SpreadElement') return;

                const configs = bindings.objectProperty(call.arguments[0], 'config');
                const openable = configs.every(function (config) {
                    if (!config.expression) return false;

                    return bindings.objectProperty(config.expression, 'openable', config.seen).every(function (value) {
                        return value.expression && bindings.resolve(value.expression, value.seen ?? new Set(), function (expression) {
                            return expression?.type === 'Literal' && expression.value === true;
                        });
                    });
                });
                if (!openable) return;

                const name = node.id.name;
                const suffix = name.endsWith('AlertDialog') ? 'AlertDialog' : name.endsWith('Dialog') ? 'Dialog' : null;
                const stem = suffix ? name.slice(0, -suffix.length) : '';
                const words = (suffix ? stem : name).match(/[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+|[0-9]+/gu) ?? [];
                if (words.some((word) => word.toLowerCase() === 'selected')) {
                    context.report({ node: node.id, messageId: 'selected', data: { name: name } });
                    return;
                }
                if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/u.test(stem)) return;

                context.report({ node: node.id, messageId: 'name', data: { name: name } });
            },
        };
    },
};
