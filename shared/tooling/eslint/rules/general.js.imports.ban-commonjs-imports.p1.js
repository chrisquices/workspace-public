// Ban CommonJS require calls and TypeScript external module references.
// Match @typescript-eslint/no-require-imports with no allowed paths/import-equals.
// Locally declared functions named require are unrelated and remain allowed.

import { findVariable } from "@eslint-community/eslint-utils";

export default {
    meta: {
        type: "problem",
        description: "Ban require imports in favor of ES module imports.",
        includeInReadme: true,
        schema: [],
        messages: {
            require: "Replace this require import with an ES module import. Preserve module loading order, side effects, exported values, and whether the import is type-only; choose the rewrite manually.",
        },
    },

    create(context) {
        return {
            'CallExpression[callee.type="Identifier"][callee.name="require"]'(node) {
                const variable = findVariable(context.sourceCode.getScope(node), "require");

                if (variable?.identifiers.length) return;

                context.report({ node: node, messageId: "require" });
            },

            TSExternalModuleReference(node) {
                context.report({ node: node, messageId: "require" });
            },
        };
    },
};
