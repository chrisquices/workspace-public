// This is the authoritative action vocabulary for imported Inertia Helper form
// declarations, whether openable or not. Only the developer may approve new
// keywords. Use the approved semantic mappings when correcting a name; never
// disguise an unsupported operation with a supported word to evade a report.

import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const supportedActions = ['new', 'edit', 'delete', 'rename', 'move', 'upload', 'search', 'restore', 'purge'];

export default {
    meta: {
        type: 'suggestion',
        description: 'Use an approved action keyword for Inertia Helper form names; ask the developer about unknown actions.',
        includeInReadme: true,
        schema: [],
        messages: {
            unsupported: 'Unsupported action keyword "{{action}}" in Inertia Helper form "{{name}}". Supported actions: {{supported}}. Use new for creating, edit for editing, delete for deleting, rename for renaming, move for moving, upload for uploading, search for searching, restore for restoring, and purge for purging. When the operation clearly matches one of these meanings, correct the name and all references while preserving behavior and the required suffix; no new keyword is needed. For any operation outside this list or whose meaning is unclear, agents must stop and ask the developer. Do not disguise an unsupported operation with a supported name, add keywords, or suppress this diagnostic without explicit developer approval. The allowlist is owned by consumer.inertia-helper.forms.require-supported-action-keywords.p1.js.',
            missing: 'Inertia Helper form "{{name}}" has no leading lowercase action keyword. Supported actions: {{supported}}. Use new for creating, edit for editing, delete for deleting, rename for renaming, move for moving, upload for uploading, search for searching, restore for restoring, and purge for purging. Correct the camelCase action-and-subject name, required suffix, and all references when the operation clearly matches; preserve behavior. For any operation outside this list or whose meaning is unclear, agents must stop and ask the developer. Do not disguise an unsupported operation with a supported name, add keywords, or suppress this diagnostic without explicit developer approval.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        return {
            VariableDeclarator(node) {
                const call = unwrapExpression(node.init);
                if (node.id.type !== 'Identifier' || call?.type !== 'CallExpression') return;

                const factory = resolveImportOrigin(call.callee, sourceCode);
                if (factory?.source !== 'workspace-packages/inertia-helper' || factory.name !== 'useInertiaHelperForm') return;

                const name = node.id.name;
                const action = /^[a-z]+/u.exec(name)?.[0];
                if (supportedActions.includes(action)) return;

                context.report({
                    node: node.id,
                    messageId: action ? 'unsupported' : 'missing',
                    data: { name: name, action: action ?? '', supported: supportedActions.join(', ') },
                });
            },
        };
    },
};
