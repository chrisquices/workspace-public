// Require one inline options object containing config then form. The existing
// js-objects-require-multiline-literals rule owns multiline object/property
// layout, and the indentation rule owns indentation. This rule keeps the call
// opening on the declaration line and its closing }); together. Shape changes
// remain manual so property evaluation order and unknown spreads are preserved.
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'layout',
        description: 'Pass inline config and form objects in that order to useInertiaHelperForm.',
        includeInReadme: true,
        schema: [],
        fixable: 'whitespace',
        messages: {
            shape: 'Pass exactly one inline object containing config followed by form to useInertiaHelperForm. Both must be explicit, noncomputed properties with inline object values. Keep config and form multiline. Correct the shape or order manually while preserving initialization order, fields, methods, comments, and behavior.',
            layout: 'Write the useInertiaHelperForm({ opening on the declaration line and keep the closing }); together. Keep config before form and both objects multiline; preserve comments, type annotations, and values.',
            manual: 'Arrange the useInertiaHelperForm call opening on the declaration line and its closing }); together manually. Preserve multiline type bodies, comments, line-sensitive directives, and their targets. Keep config before form with both objects multiline.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const directives = sourceCode.getAllComments().filter(isLineDirective);

        return {
            CallExpression(node) {
                const factory = resolveImportOrigin(node.callee, sourceCode);
                if (factory?.source !== 'workspace-packages/inertia-helper' || factory.name !== 'useInertiaHelperForm') return;

                const argument = unwrapExpression(node.arguments[0]);
                const properties = argument?.type === 'ObjectExpression' ? argument.properties : [];
                if (node.arguments.length !== 1 || properties.length !== 2
                    || !properties.every((property, index) => property.type === 'Property'
                        && property.kind === 'init' && !property.method && !property.computed && !property.shorthand
                        && getStaticPropertyName(property) === ['config', 'form'][index]
                        && unwrapExpression(property.value)?.type === 'ObjectExpression')) {
                    context.report({ node: node, messageId: 'shape' });
                    return;
                }

                // Keep assertions and other wrappers intact; do not join tokens
                // through them as though they were direct object delimiters.
                if (node.arguments[0] !== argument) return;
                const declarator = node.parent?.type === 'VariableDeclarator' && node.parent.init === node ? node.parent : null;
                const declaration = declarator?.parent;
                const start = declarator
                    ? declaration.declarations[0] === declarator ? declaration : declarator
                    : node;
                const open = sourceCode.getTokenAfter(node.typeArguments ?? node.typeParameters ?? node.callee);
                const argumentOpen = sourceCode.getFirstToken(argument);
                const argumentClose = sourceCode.getLastToken(argument);
                const close = sourceCode.getLastToken(node);
                if (open?.value !== '(' || close.value !== ')') return;

                const edits = new Map();
                let violation = false;
                let safe = true;
                function replaceGap(left, right, text) {
                    const range = [left.range[1], right.range[0]];
                    const gap = sourceCode.text.slice(...range);
                    if (gap === text) return;
                    violation = true;
                    if (!/^\s*$/u.test(gap)) {
                        safe = false;
                        return;
                    }
                    edits.set(range.join(','), { range: range, text: text });
                }

                const prefix = sourceCode.getTokens(start, { includeComments: true })
                    .filter((token) => token.range[1] <= open.range[1]);
                if (start.loc.start.line !== open.loc.end.line) {
                    violation = true;
                    // Multiline type/object bodies have their own layout rules.
                    if (prefix.some((token) => token.value === '{' || token.type === 'Line'
                        || token.loc.start.line !== token.loc.end.line)) safe = false;
                    for (let index = 1; index < prefix.length; index++) {
                        if (prefix[index - 1].loc.end.line < prefix[index].loc.start.line) {
                            replaceGap(prefix[index - 1], prefix[index], ' ');
                        }
                    }
                }
                replaceGap(node.typeArguments ?? node.typeParameters ?? node.callee, open, '');
                replaceGap(open, argumentOpen, '');

                // A trailing argument comma is valid JS and must not be removed
                // as whitespace; keep it adjacent if one has been authored.
                const beforeClose = sourceCode.getTokenBefore(close);
                if (beforeClose.value === ',' && beforeClose.range[0] >= argumentClose.range[1]) {
                    replaceGap(argumentClose, beforeClose, '');
                    replaceGap(beforeClose, close, '');
                } else {
                    replaceGap(argumentClose, close, '');
                }
                const next = sourceCode.getTokenAfter(close);
                if (next?.value === ';') replaceGap(close, next, '');
                if (!violation) return;

                if (directives.some((comment) => comment.loc.start.line <= node.loc.end.line
                    && comment.loc.end.line + 1 >= start.loc.start.line)) safe = false;
                context.report({
                    node: node,
                    messageId: safe ? 'layout' : 'manual',
                    fix(fixer) {
                        if (!safe) return null;
                        return [...edits.values()].map((edit) => fixer.replaceTextRange(edit.range, edit.text));
                    },
                });
            },
        };
    },
};
