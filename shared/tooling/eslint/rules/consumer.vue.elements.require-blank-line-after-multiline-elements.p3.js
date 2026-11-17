// Separate multiline elements from following sibling content, never from their
// parent's closing tag. Single-liner siblings remain compact. Explicit UI parent
// spacing/layout policies take precedence, including across runner priorities.
// Keep leading comments with the following sibling. Only fix existing multiline
// markup gaps; text, interpolation, and inline adjacency require manual handling.
// Preformatted content, v-pre, and SVG text contexts are excluded entirely.

import { hasComponentSpacingPolicy } from '#eslint/helpers/has-component-spacing-policy.js';
import { getPreviousNonWhitespaceToken } from '#eslint/helpers/get-previous-non-whitespace-token.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate multiline Vue template elements from following sibling content with a blank line.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            spacing: 'Add exactly one blank line after multiline <{{element}}> before the following sibling content. Keep leading comments attached to that content; do not add padding before the parent closing tag.',
            manual: 'Separate multiline <{{element}}> from the following sibling content with one blank line manually, preserving rendered text, inline spacing, and line-sensitive comment targets.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokens = services.getTemplateBodyTokenStore();
        const directives = tokens.getTokens(template, { includeComments: true }).filter(isLineDirective);
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';

        return services.defineTemplateBodyVisitor({
            VElement(parent) {
                if (hasComponentSpacingPolicy(sourceCode, parent)) return;
                for (let current = parent; current?.type === 'VElement'; current = current.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(current.rawName)
                        || (current.namespace === 'http://www.w3.org/2000/svg' && ['text', 'tspan', 'textPath'].includes(current.rawName))
                        || current.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return;
                }

                const siblings = parent.children.filter((child) => child.type === 'VElement'
                    || child.type === 'VExpressionContainer' || (child.type === 'VText' && child.value.trim()));
                for (let index = 1; index < siblings.length; index++) {
                    const left = siblings[index - 1];
                    const right = siblings[index];
                    if (left.type !== 'VElement' || left.loc.start.line === left.loc.end.line) continue;

                    let anchor = right;
                    if (right.type === 'VText') {
                        const padding = sourceCode.getText(right).match(/^\s*/u)[0].length;
                        const start = right.range[0] + padding;
                        anchor = { range: [start, right.range[1]], loc: { start: sourceCode.getLocFromIndex(start), end: right.loc.end } };
                    }
                    while (true) {
                        const comment = getPreviousNonWhitespaceToken(tokens, anchor);
                        if (comment?.type !== 'HTMLComment' || comment.range[0] < left.range[1]
                            || comment.loc.end.line >= anchor.loc.start.line
                            || sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim()
                            || !/^\s*$/u.test(sourceCode.text.slice(comment.range[1], anchor.range[0]))) break;
                        anchor = comment;
                    }

                    const end = anchor.range[0];
                    const gap = sourceCode.text.slice(left.range[1], end).match(/\s*$/u)[0];
                    const breaks = gap.match(/\r\n|[\r\n\u2028\u2029]/gu) ?? [];
                    if (breaks.length === 2) continue;

                    const safe = right.type === 'VElement' && breaks.length > 0
                        && tokens.getTokensBetween(left, right, { includeComments: true })
                            .every((token) => ['HTMLWhitespace', 'HTMLComment'].includes(token.type))
                        && !directives.some((comment) => comment.loc.start.line <= anchor.loc.start.line
                            && comment.loc.end.line + 1 >= left.loc.end.line);
                    const indent = gap.split(/\r\n|[\r\n\u2028\u2029]/u).at(-1);
                    context.report({
                        loc: anchor.loc,
                        messageId: safe ? 'spacing' : 'manual',
                        data: { element: left.rawName },
                        fix: safe ? (fixer) => fixer.replaceTextRange([end - gap.length, end], newline + newline + indent) : undefined,
                    });
                }
            },
        });
    },
};
