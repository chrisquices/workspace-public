// Put the opening tag, direct child elements, and closing tag on separate lines
// whenever an element contains child elements. Text-only elements may stay inline.
// Use Vue's template tokens for both native tags and components. The approved
// layout takes precedence over rendered spacing added beside text/interpolations.
// Preserve existing spaces, entities, and token contents. Keep preformatted/SVG
// text and line-sensitive directives report-only.

export default {
    meta: {
        type: 'layout',
        description: 'Place child elements and their parent opening and closing tags on separate lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            layout: 'Insert a line break at this boundary. <{{element}}> contains child elements, so its opening tag, each direct child element, and closing tag must occupy separate lines. Preserve each child element, its text, and its attributes.',
            manual: 'Separate this boundary manually. <{{element}}> contains child elements, so its opening tag, each direct child element, and closing tag must occupy separate lines. Preserve preformatted content, SVG text, non-whitespace boundary content, and the targets of line directives. These prevent a safe automatic whitespace rewrite.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;

        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) {
            return {};
        }

        const tokens = services.getTemplateBodyTokenStore();
        const tokenOptions = {
            includeComments: true,
            filter(token) {
                return token.type !== 'HTMLWhitespace';
            },
        };
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
        const reported = new Set();
        const plannedIndents = new WeakMap();
        const directiveLines = new Set();

        for (const comment of tokens.getTokens(template, { includeComments: true })) {
            if (comment.type === 'HTMLComment' && /eslint-(?:disable|enable)-(?:next-line|line)\b/u.test(comment.value)) {
                directiveLines.add(comment.loc.end.line);
                directiveLines.add(comment.loc.end.line + 1);
            }
        }

        function indentation(node) {
            return sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
        }

        return services.defineTemplateBodyVisitor({
            VElement(node) {
                const elements = node.children.filter(function (child) {
                    return child.type === 'VElement';
                });

                if (elements.length === 0 || !node.endTag || node.startTag.selfClosing) {
                    return;
                }

                const actualIndent = indentation(node);
                const indent = plannedIndents.get(node) ?? actualIndent;
                const parentIndent = node.parent?.type === 'VElement' ? indentation(node.parent) : '';
                let unit = indent.includes('\t') ? '\t' : '    ';

                if (actualIndent.startsWith(parentIndent) && actualIndent.length > parentIndent.length) {
                    unit = actualIndent.slice(parentIndent.length);
                }

                for (const child of elements) {
                    const childIndent = indentation(child);

                    if (child.loc.start.line > node.startTag.loc.end.line && childIndent.startsWith(actualIndent)
                        && childIndent.length > actualIndent.length) {
                        unit = childIndent.slice(actualIndent.length);
                        break;
                    }
                }

                let sensitive = false;

                for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                        || (ancestor.namespace === 'http://www.w3.org/2000/svg'
                            && ['text', 'tspan', 'textPath'].includes(ancestor.rawName))
                        || ancestor.startTag.attributes.some(function (attribute) {
                            return attribute.directive && attribute.key.name.name === 'pre';
                        })) {
                        sensitive = true;
                        break;
                    }
                }

                function separate(left, right, nextIndent) {
                    if (left.loc.end.line < right.loc.start.line) {
                        return false;
                    }

                    const range = [left.range[1], right.range[0]];
                    const gap = sourceCode.text.slice(...range);
                    const manual = sensitive || !/^[\t \f]*$/u.test(gap)
                        || directiveLines.has(left.loc.end.line) || directiveLines.has(right.loc.start.line);
                    const key = range.join(',');

                    if (!reported.has(key)) {
                        reported.add(key);
                        context.report({
                            node: right,
                            messageId: manual ? 'manual' : 'layout',
                            data: { element: node.rawName },
                            fix(fixer) {
                                return manual ? null : fixer.replaceTextRange(range, newline + nextIndent + gap);
                            },
                        });
                    }

                    return !manual;
                }

                for (const child of elements) {
                    const first = tokens.getFirstToken(child);
                    const last = tokens.getLastToken(child);

                    if (separate(tokens.getTokenBefore(child, tokenOptions), first, indent + unit)) {
                        plannedIndents.set(child, indent + unit);
                    }

                    const next = tokens.getTokenAfter(child, tokenOptions);
                    separate(last, next, next.range[0] === node.endTag.range[0] ? indent : indent + unit);
                }

                const open = tokens.getLastToken(node.startTag);
                const close = tokens.getFirstToken(node.endTag);
                separate(open, tokens.getTokenAfter(open, tokenOptions), indent + unit);
                separate(tokens.getTokenBefore(close, tokenOptions), close, indent);
            },
        });
    },
};
