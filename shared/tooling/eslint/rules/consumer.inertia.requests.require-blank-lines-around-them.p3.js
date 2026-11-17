import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const statementLists = new Set(['Program', 'BlockStatement', 'SwitchCase', 'StaticBlock', 'TSModuleBlock']);
const functionBoundaries = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration', 'PropertyDefinition', 'AccessorProperty']);

export default {
    meta: {
        type: 'layout',
        description: 'Separate Inertia request statements from neighboring statements with blank lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line {{position}} this Inertia request statement. Keep comments and directives attached to their statements; do not pad block or script boundaries.',
            manual: 'Add a blank line {{position}} this Inertia request statement manually, preserving line directives and their target statements.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);
        const calls = [];
        const reported = new Set();
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter(function (node) {
            return node.type === 'VElement' && node.rawName === 'script';
        });
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function checkCall(call) {
            if (!bindings.request(call)) {
                return;
            }

            let statement = call;

            while (statement.parent && !statementLists.has(statement.parent.type)) {
                if (functionBoundaries.has(statement.parent.type)) {
                    return;
                }

                statement = statement.parent;
            }

            const parent = statement.parent;
            let siblings = parent?.type === 'SwitchCase' ? parent.consequent : parent?.body;

            if (!Array.isArray(siblings)) {
                return;
            }

            if (scripts) {
                const script = scripts.find(function (node) {
                    return node.startTag.range[1] <= call.range[0] && call.range[1] <= (node.endTag?.range[0] ?? node.range[1]);
                });

                if (!script) {
                    return;
                }

                siblings = siblings.filter(function (node) {
                    return script.startTag.range[1] <= node.range[0] && node.range[1] <= (script.endTag?.range[0] ?? script.range[1]);
                });
            }

            const index = siblings.indexOf(statement);

            if (index < 0) return;

            for (const [previous, current, position] of [
                [siblings[index - 1], statement, 'before'],
                [statement, siblings[index + 1], 'after'],
            ]) {
                if (!previous || !current) continue;
                const boundary = `${previous.range[1]}:${current.range[0]}`;
                if (reported.has(boundary)) continue;
                const comments = sourceCode.getCommentsBefore(current).filter(function (comment) {
                    return comment.range[0] >= previous.range[1];
                });
                const parts = [previous, ...comments, current];
                const needsSpacing = parts.slice(1).every(function (next, partIndex) {
                    const before = parts[partIndex];
                    return next.loc.start.line <= before.loc.end.line + 1
                        && sourceCode.text.slice(before.range[1], next.range[0]).trim() === '';
                });
                if (!needsSpacing) continue;

                const anchor = comments.find(function (comment) {
                    return comment.loc.start.line > previous.loc.end.line;
                }) ?? current;
                const beforeAnchor = parts[parts.indexOf(anchor) - 1];
                const safe = !comments.some(function (comment) {
                    return comment.range[1] <= anchor.range[0] && isLineDirective(comment);
                });
                const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                reported.add(boundary);
                context.report({
                    node: statement,
                    messageId: safe ? 'spacing' : 'manual',
                    data: { position: position },
                    fix(fixer) {
                        if (!safe) return null;
                        return fixer.replaceTextRange([beforeAnchor.range[1], anchor.range[0]], newline + newline + indent);
                    },
                });
            }
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
