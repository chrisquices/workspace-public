// Separate adjacent statements in the same statement list onto different lines.
// Compare complete AST nodes so multiline statements, variable declarators, and
// loop headers retain their shape. P3 function, export, and if-spacing rules may
// add further separation. Preserve comments and line-sensitive directives by
// reporting ambiguous boundaries for manual correction.

import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Require adjacent JavaScript and TypeScript statements to occupy separate lines, including Vue scripts and event handlers. Autofix whitespace boundaries while preserving comments and line-sensitive directives.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            separate: 'Start this statement on a new line after the preceding statement. Preserve both complete statements, their semicolons, execution order, and any multiline content.',
            manual: 'Separate these adjacent statements onto different lines manually. Preserve intervening comment ownership and the targets of same-line or next-line ESLint and TypeScript directives when choosing the line break.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const template = sourceCode.ast.templateBody;
        const templateTokens = sourceCode.parserServices.getTemplateBodyTokenStore?.();
        const comments = [...sourceCode.getAllComments()];
        const protectedLines = new Set();
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        if (template && templateTokens) {
            comments.push(...templateTokens.getTokens(template, { includeComments: true }).filter(function (token) {
                return ['Line', 'Block', 'HTMLComment'].includes(token.type);
            }));
        }

        for (const comment of comments) {
            if (!isLineDirective(comment)) {
                continue;
            }

            for (let line = comment.loc.start.line; line <= comment.loc.end.line + 1; line++) {
                protectedLines.add(line);
            }
        }

        function checkStatements(node) {
            const statements = node.body ?? node.consequent;

            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];

                if (previous.loc.end.line !== current.loc.start.line) {
                    continue;
                }

                const range = [previous.range[1], current.range[0]];
                const safe = /^\s*$/u.test(sourceCode.text.slice(...range))
                    && !protectedLines.has(current.loc.start.line);

                context.report({
                    node: current,
                    messageId: safe ? 'separate' : 'manual',
                    fix(fixer) {
                        if (!safe) {
                            return null;
                        }

                        const indentation = sourceCode.lines[previous.loc.start.line - 1].match(/^[\t ]*/u)[0];
                        const indent = node.type !== 'Program' && previous.loc.start.line === node.loc.start.line
                            ? indentation + '    ' : indentation;

                        return fixer.replaceTextRange(range, newline + indent);
                    },
                });
            }
        }

        const visitor = {
            Program: checkStatements,
            BlockStatement: checkStatements,
            StaticBlock: checkStatements,
            TSModuleBlock: checkStatements,
            SwitchCase: checkStatements,
            VOnExpression: checkStatements,
        };

        return sourceCode.parserServices.defineTemplateBodyVisitor?.(visitor, visitor) ?? visitor;
    },
};
