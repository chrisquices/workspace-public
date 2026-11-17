// Order statements independently inside each Vue script block as imports,
// types/interfaces, defineProps, then remaining statements. Sections may be absent.
// Hoist static imports and erased types in comment-free scripts, preserving the
// relative order of imports and executable statements. Executable props moves,
// comment ownership, and ambiguous automatic-semicolon boundaries stay manual.

import { getVuePropsMacroName } from '#eslint/helpers/get-vue-props-macro-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const sections = ['imports', 'types/interfaces', 'defineProps', 'other statements'];

export default {
    meta: {
        type: 'suggestion',
        description: 'Order Vue script imports, types and interfaces, props, then other statements.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            order: 'Move {{section}} before {{previous}} in this script block. The required order is imports, types/interfaces, defineProps, then other statements. Keep comments attached and review initialization dependencies and side effects before reordering manually.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();

        if (!document) {
            return {};
        }

        const scripts = document.children.filter(function (node) {
            return node.type === 'VElement' && node.rawName === 'script';
        });

        function isPropsExpression(expression) {
            const node = unwrapExpression(expression);

            if (node?.type !== 'CallExpression') {
                return false;
            }

            const name = getVuePropsMacroName(node.callee, sourceCode);

            return name === 'defineProps' || (name === 'withDefaults' && isPropsExpression(node.arguments[0]));
        }

        function sectionOf(statement) {
            const node = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(statement.type) && statement.declaration
                ? statement.declaration : statement;

            if (['ImportDeclaration', 'TSImportEqualsDeclaration'].includes(node.type)) {
                return 0;
            }

            const typeExport = node.exportKind === 'type' || (node.type === 'ExportNamedDeclaration'
                && node.specifiers.length > 0 && node.specifiers.every(function (specifier) {
                    return specifier.exportKind === 'type';
                }));

            if (['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'].includes(node.type) || typeExport) {
                return 1;
            }

            if ((node.type === 'ExpressionStatement' && isPropsExpression(node.expression))
                || (node.type === 'VariableDeclaration' && node.declarations.some(function (declaration) {
                    return isPropsExpression(declaration.init);
                }))) {
                return 2;
            }

            return 3;
        }

        return {
            'Program:exit'(program) {
                for (const script of scripts) {
                    let highestSection = 0;
                    const contentEnd = script.endTag?.range[0] ?? script.range[1];
                    const statements = program.body.filter((statement) => statement.range[0] >= script.startTag.range[1]
                        && statement.range[1] <= contentEnd);
                    const imports = statements.filter((statement) => statement.type === 'ImportDeclaration');
                    const types = statements.filter((statement) => sectionOf(statement) === 1);
                    const movable = new Set([...imports, ...types]);
                    const ordered = [...imports, ...types, ...statements.filter((statement) => !movable.has(statement))];
                    const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
                    const canReorder = ordered.some((statement, index) => statement !== statements[index])
                        && !sourceCode.getAllComments().some((comment) => comment.range[0] >= script.startTag.range[1] && comment.range[1] <= contentEnd)
                        && statements.every((statement) => {
                            const declaration = statement.declaration ?? statement;
                            return !statement.directive && (statement.type === 'ImportDeclaration'
                                || ['FunctionDeclaration', 'ClassDeclaration', 'TSInterfaceDeclaration'].includes(declaration.type)
                                || sourceCode.getLastToken(statement).value === ';');
                        });
                    let offeredFix = false;

                    for (const statement of statements) {
                        if (statement.type === 'EmptyStatement' || statement.range[0] < script.startTag.range[1]
                            || statement.range[1] > contentEnd) {
                            continue;
                        }

                        const section = sectionOf(statement);

                        if (section < highestSection) {
                            const fixable = canReorder && !offeredFix;
                            offeredFix = true;
                            context.report({
                                node: statement,
                                messageId: 'order',
                                data: { section: sections[section], previous: sections[highestSection] },
                                fix(fixer) {
                                    return fixable ? fixer.replaceTextRange(
                                        [statements[0].range[0], statements.at(-1).range[1]],
                                        ordered.map((entry) => sourceCode.getText(entry)).join(newline),
                                    ) : null;
                                },
                            });
                        }

                        highestSection = Math.max(highestSection, section);
                    }
                }
            },
        };
    },
};
