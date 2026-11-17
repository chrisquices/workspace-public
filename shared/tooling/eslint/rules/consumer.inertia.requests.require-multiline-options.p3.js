// Expand nonempty inline Inertia request options in JavaScript, TypeScript, and
// Vue scripts. Start each top-level property below the opening brace and put the
// closing brace on a separate line. Preserve payloads, property contents, comments,
// and existing line endings. Leave empty objects and referenced options unchanged.

import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const lineBreak = /[\r\n\u2028\u2029]/u;

export default {
    meta: {
        type: 'layout',
        description: 'Put each property of nonempty inline Inertia request options on a separate line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            layout: 'Expand this Inertia request options object. Put each top-level property on its own line below the opening brace and put the closing brace on a separate line. Preserve payload data, callback bodies, values, comments, and line endings.',
            manual: 'Expand this Inertia request options object manually, putting each top-level property and the closing brace on separate lines. Preserve the target of every ESLint or TypeScript line directive while keeping payload data, callback bodies, values, and comments unchanged.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);
        const calls = [];
        const defaultNewline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function indentation(node) {
            return sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
        }

        function checkCall(node) {
            const options = bindings.requestOptions(node);

            if (options?.type !== 'ObjectExpression' || options.properties.length === 0) {
                return;
            }

            const newline = sourceCode.getText(options).match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? defaultNewline;
            const indent = indentation(node);
            let unit = indent.includes('\t') ? '\t' : '    ';

            for (let parent = node.parent; parent; parent = parent.parent) {
                const parentIndent = indentation(parent);

                if (parent.loc.start.line < node.loc.start.line && indent.startsWith(parentIndent)
                    && parentIndent.length < indent.length) {
                    unit = indent.slice(parentIndent.length);
                    break;
                }
            }

            const edits = new Map();

            function separate(left, right, nextIndent) {
                const range = [left.range[1], right.range[0]];
                const gap = sourceCode.text.slice(...range);

                if (!/^\s*$/u.test(gap)) {
                    return;
                }

                const text = lineBreak.test(gap)
                    ? gap.replace(/[\t ]*$/u, nextIndent) : newline + nextIndent;

                if (text !== gap) {
                    edits.set(range.join(','), { range: range, text: text });
                }
            }

            const open = sourceCode.getFirstToken(options);
            const close = sourceCode.getLastToken(options);
            separate(open, sourceCode.getTokenAfter(open, { includeComments: true }), indent + unit);

            for (const property of options.properties) {
                separate(sourceCode.getTokenBefore(property, { includeComments: true }), property, indent + unit);
            }

            separate(sourceCode.getTokenBefore(close, { includeComments: true }), close, indent);

            if (edits.size === 0) {
                return;
            }

            const comments = [
                ...sourceCode.getCommentsBefore(node),
                ...sourceCode.getCommentsInside(options),
                ...sourceCode.getCommentsAfter(node),
            ];
            const manual = comments.some(isLineDirective);

            context.report({
                node: options,
                messageId: manual ? 'manual' : 'layout',
                fix(fixer) {
                    if (manual) {
                        return null;
                    }

                    return [...edits.values()].map(function (edit) {
                        return fixer.replaceTextRange(edit.range, edit.text);
                    });
                },
            });
        }

        return {
            CallExpression(node) {
                calls.push(node);
            },

            'Program:exit'() {
                bindings.registerForms(calls);

                for (const call of calls) {
                    checkCall(call);
                }
            },
        };
    },
};
