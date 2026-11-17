import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Remove eligible blank code lines before later formatting priorities restore required spacing.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            blankLine: 'Remove these blank code lines. Preserve comments, literal values, attribute content, whitespace-sensitive markup, and style or custom blocks. Later priorities restore spacing required by other rules.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;

        return {
            Program() {
                const protectedLines = new Set();
                const document = sourceCode.parserServices.getDocumentFragment?.();
                const comments = [...sourceCode.getAllComments(), ...(document?.comments ?? [])];

                function protect(node) {
                    for (let line = node.loc.start.line; line <= node.loc.end.line; line++) {
                        protectedLines.add(line);
                    }
                }

                // Token interiors include multiline strings and template quasis;
                // whitespace between tokens remains eligible for cleanup.
                for (const token of sourceCode.getTokens(sourceCode.ast)) protect(token);
                for (const comment of comments) {
                    protect(comment);
                    if (isLineDirective(comment)) protectedLines.add(comment.loc.end.line + 1);
                }

                const pending = document?.children.filter((node) => node.type === 'VElement') ?? [];
                for (const node of pending) {
                    const customBlock = node.parent?.type === 'VDocumentFragment' && !['script', 'template'].includes(node.rawName);
                    const sensitive = ['pre', 'textarea'].includes(node.rawName.toLowerCase())
                        || node.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre');

                    if (customBlock || sensitive || (node.rawName === 'script' && node.parent.type !== 'VDocumentFragment')) {
                        protect(node);
                        continue;
                    }

                    for (const attribute of node.startTag.attributes) {
                        if (attribute.value) protect(attribute.value);
                    }
                    for (const child of node.children) {
                        if (child.type === 'VElement') pending.push(child);
                        else if (node.rawName !== 'script' && child.type === 'VText' && child.value.trim()) protect(child);
                    }
                }

                for (let index = 0; index < lines.length; index++) {
                    if (lines[index].trim() !== '' || protectedLines.has(index + 1)) {
                        continue;
                    }

                    const start = sourceCode.getIndexFromLoc({ line: index + 1, column: 0 });

                    while (index + 1 < lines.length && lines[index + 1].trim() === '' && !protectedLines.has(index + 2)) {
                        index++;
                    }

                    const end = index + 1 < lines.length
                        ? sourceCode.getIndexFromLoc({ line: index + 2, column: 0 })
                        : sourceCode.text.length;

                    if (start === end) {
                        continue;
                    }

                    context.report({
                        loc: {
                            start: sourceCode.getLocFromIndex(start),
                            end: sourceCode.getLocFromIndex(end),
                        },
                        messageId: 'blankLine',
                        fix(fixer) {
                            return fixer.removeRange([start, end]);
                        },
                    });
                }
            },
        };
    },
};
