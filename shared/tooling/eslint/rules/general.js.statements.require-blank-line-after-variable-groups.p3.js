// Separate a run of const/let declarations from the next non-declaration.
// Each declaration initialized with Vue reactive() ends its own group, even
// before another const/let. Resolve imports rather than guessing from names.
// Work on statement lists, never loop headers or file/block edges. Follow the
// existing interface-spacing rule's handling of comments and Vue script blocks.
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

function isVariableDeclaration(statement) {
    const declaration = statement.declaration ?? statement;
    return declaration.type === 'VariableDeclaration' && ['const', 'let'].includes(declaration.kind);
}

function hasReactiveInitializer(statement, sourceCode) {
    const declaration = statement.declaration ?? statement;
    return declaration.declarations.some((entry) => {
        const init = unwrapExpression(entry.init);
        if (init?.type !== 'CallExpression') return false;

        const binding = resolveImportOrigin(init.callee, sourceCode);
        return binding?.source === 'vue' && binding.name === 'reactive';
    });
}

export default {
    meta: {
        type: 'layout',
        description: 'Require a blank line after const/let groups and after each Vue reactive const/let declaration before the next statement, including another declaration.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            spacing: 'Add a blank line after this group of const/let declarations, before the next statement. Keep trailing comments and leading documentation attached to their statements.',
            reactiveSpacing: 'Add a blank line after this reactive const/let declaration, even before another variable declaration. Keep trailing comments and leading documentation attached to their statements.',
            manual: 'Add a blank line after this group of const/let declarations manually, preserving line-sensitive directives and their target statements.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
        const lineDirectives = sourceCode.getAllComments().filter(isLineDirective);

        function checkStatements(node) {
            const statements = (node.body ?? node.consequent).filter((statement) => statement.type !== 'EmptyStatement');
            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];
                if (!isVariableDeclaration(previous)) continue;
                const reactive = hasReactiveInitializer(previous, sourceCode);
                if (!reactive && isVariableDeclaration(current)) continue;
                if (node.type === 'Program' && scripts && !scripts.some((script) =>
                    script.startTag.range[1] <= previous.range[0]
                    && current.range[1] <= (script.endTag?.range[0] ?? script.range[1]))) continue;

                const comments = sourceCode.getCommentsBefore(current).filter((comment) => comment.range[0] >= previous.range[1]);
                const boundaries = [previous, ...comments, current];
                const separated = boundaries.slice(1).some((next, position) => sourceCode.lines
                    .slice(boundaries[position].loc.end.line, next.loc.start.line - 1)
                    .some((line) => line.trim() === ''));
                if (separated) continue;

                const anchor = comments.find((comment) => comment.loc.start.line > previous.loc.end.line
                    || (comment.type === 'Block' && sourceCode.getText(comment).startsWith('/**'))) ?? current;
                const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];
                const sameLine = anchor.loc.start.line === beforeAnchor.loc.end.line;
                const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment))
                    && !(sameLine && lineDirectives.some((comment) => comment.loc.start.line <= anchor.loc.start.line
                        && comment.loc.end.line + 1 >= anchor.loc.start.line));

                context.report({
                    node: current,
                    messageId: safe ? (reactive ? 'reactiveSpacing' : 'spacing') : 'manual',
                    fix(fixer) {
                        if (!safe) return null;
                        if (sameLine) {
                            const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                            const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                            return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                        }
                        const start = sourceCode.getIndexFromLoc({line: anchor.loc.start.line, column: 0});
                        return fixer.insertTextBeforeRange([start, start], newline);
                    },
                });
            }
        }

        return {
            Program: checkStatements,
            BlockStatement: checkStatements,
            StaticBlock: checkStatements,
            TSModuleBlock: checkStatements,
            SwitchCase: checkStatements,
        };
    },
};
