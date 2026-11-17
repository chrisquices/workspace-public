// Move a single Head ahead of all root-template content when its scope, mounting
// conditions, root attribute inheritance, and surrounding text are preserved.
// Cross unconditional native HTML wrappers only. Keep scoped, conditional, keyed,
// or component ancestors and lint
// directives manual. Copy the complete Head source without rewriting its contents.

import { isHTMLTag } from '@vue/shared';
import { createInertiaHeadVisitor } from '#eslint/helpers/create-inertia-head-visitor.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const safeDirectives = new Set(['bind', 'on', 'show', 'model', 'cloak']);
const lineBreak = /\r\n|[\n\r]/u;

export default {
    meta: {
        type: 'suggestion',
        description: 'Place Inertia Head as the first direct child of the root template.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            position: 'Move <{{name}}> directly inside the root <template> as its first content, before comments and other markup. Preserve the complete component, including attributes and metadata children.',
            manual: 'Move <{{name}}> directly inside the root <template> as its first content manually. Automatic relocation could change scoped bindings, conditional or keyed mounting, component or slot context, root attribute inheritance, rendered text spacing, lint directive targets, or ordering among multiple Head components. Preserve these behaviors and the complete component while correcting its position.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        function canMove(node, template, heads) {
            if (heads.length !== 1) {
                return false;
            }

            const roots = template.children.filter(function (child) {
                return child.type !== 'VText' || !/^[\t \r\n\f]*$/u.test(child.value);
            });

            if (node.parent !== template && roots.length === 1) {
                return false;
            }

            for (let current = node; current !== template; current = current.parent) {
                if (current.namespace !== 'http://www.w3.org/1999/xhtml' || current.variables.length > 0
                    || (current !== node && (!isHTMLTag(current.rawName) || current.rawName === 'slot'))) {
                    return false;
                }

                if (current.startTag.attributes.some(function (attribute) {
                    if (!attribute.directive) {
                        return ['key', 'is'].includes(attribute.key.name);
                    }

                    if (!safeDirectives.has(attribute.key.name.name)) {
                        return true;
                    }

                    const argument = attribute.key.argument;

                    return attribute.key.name.name === 'bind'
                        && (argument?.type !== 'VIdentifier' || ['key', 'is'].includes(argument.name));
                })) {
                    return false;
                }

                if (current.parent.children.some(function (child) {
                    return child.type === 'VExpressionContainer'
                        || (child.type === 'VText' && !/^[\t \r\n\f]*$/u.test(child.value));
                })) {
                    return false;
                }
            }

            const siblings = node.parent.children;
            const index = siblings.indexOf(node);

            if ([siblings[index - 1], siblings[index + 1]].some(function (sibling) {
                return sibling?.type === 'VText' && sibling.value !== '' && !lineBreak.test(sibling.value);
            })) {
                return false;
            }

            const tokens = sourceCode.parserServices.getTemplateBodyTokenStore();

            return !tokens.getTokens(template, { includeComments: true }).some(function (token) {
                return token.type === 'HTMLComment' && token.loc.start.line <= node.loc.end.line
                    && (isLineDirective(token) || /\beslint-(?:disable|enable)\b/u.test(token.value));
            });
        }

        return createInertiaHeadVisitor(context, function (node, template, heads) {
            const preceding = node.parent === template
                ? sourceCode.text.slice(template.startTag.range[1], node.range[0]) : null;

            if (preceding !== null && /^[\t \r\n\f]*$/u.test(preceding)) {
                return;
            }

            const safe = canMove(node, template, heads);

            context.report({
                node: node,
                messageId: safe ? 'position' : 'manual',
                data: { name: node.rawName },
                fix(fixer) {
                    if (!safe) {
                        return null;
                    }

                    const start = template.startTag.range[1];
                    const leading = sourceCode.text.slice(start).match(/^[\t \r\n\f]*/u)[0];
                    const newline = sourceCode.getText(template).match(lineBreak)?.[0]
                        ?? sourceCode.text.match(lineBreak)?.[0] ?? '\n';
                    const indent = lineBreak.test(leading) ? leading.split(lineBreak).at(-1) : '    ';
                    const following = lineBreak.test(leading) ? leading : newline + indent;
                    const moved = newline + indent + sourceCode.getText(node) + following;
                    const lineStart = sourceCode.getIndexFromLoc({ line: node.loc.start.line, column: 0 });
                    const lineEnd = node.loc.end.line < sourceCode.lines.length
                        ? sourceCode.getIndexFromLoc({ line: node.loc.end.line + 1, column: 0 }) : sourceCode.text.length;
                    const ownLines = sourceCode.text.slice(lineStart, node.range[0]).trim() === ''
                        && sourceCode.text.slice(node.range[1], lineEnd).trim() === '';

                    return [
                        fixer.replaceTextRange([start, start + leading.length], moved),
                        fixer.removeRange(ownLines ? [lineStart, lineEnd] : node.range),
                    ];
                },
            });
        });
    },
};
