import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

// The global child-element layout rule owns separation of nested elements.
// Component single-line layouts apply to text-only content. Preserve attribute
// values, expressions, comments, and whitespace-sensitive text during fixes.
// Multiline opening tags keep separate content lines under the global rule.
function preservesWhitespace(node) {
    for (let current = node; current?.type === 'VElement'; current = current.parent) {
        if (['pre', 'textarea', 'script', 'style'].includes(current.rawName)
            || current.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) {
            return true;
        }
    }

    return false;
}

function multilineClassArray(attribute) {
    if (!attribute.directive || attribute.key.name.name !== 'bind') return false;

    const argument = attribute.key.argument;
    const name = argument?.type === 'VIdentifier' ? argument.name
        : argument?.expression?.type === 'Literal' ? argument.expression.value
            : argument?.expression?.type === 'TemplateLiteral' && !argument.expression.expressions.length
                ? argument.expression.quasis[0].value.cooked : undefined;
    const expression = unwrapExpression(attribute.value?.expression);

    return name === 'class' && expression?.type === 'ArrayExpression' && expression.elements.length > 1;
}

function classArrayLines(node) {
    return node.startTag.attributes.filter(multilineClassArray)
        .reduce((total, attribute) => total + attribute.loc.end.line - attribute.loc.start.line, 0);
}

function fixOneLine(fixer, sourceCode, node) {
    if (preservesWhitespace(node)) return null;

    const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore?.();
    if (!tokenStore) return null;
    const attributes = node.startTag.attributes.map((attribute) => sourceCode.getText(attribute));
    const interpolations = new Map();

    for (const child of node.children) {
        if (child.type !== 'VExpressionContainer' || !child.expression
            || child.loc.start.line === child.loc.end.line) continue;

        const expression = sourceCode.getText(child).slice(2, -2).trim();
        const tokens = tokenStore.getTokens(child, {includeComments: true});
        if (!expression || /[\r\n\u2028\u2029]/u.test(expression)
            || tokens.some((token) => ['Line', 'Block', 'HTMLComment'].includes(token.type))) continue;

        interpolations.set(child, `{{ ${expression} }}`);
    }

    if (node.startTag.attributes.some((attribute) => /[\r\n]/.test(sourceCode.getText(attribute)) && !multilineClassArray(attribute))
        || node.children.some((child) => child.type !== 'VText'
            && (child.type !== 'VExpressionContainer'
                || (child.loc.start.line !== child.loc.end.line && !interpolations.has(child))))
        || tokenStore.getTokens(node, {includeComments: true}).some((token) => token.type === 'HTMLComment')) {
        return null;
    }

    const opening = `<${node.rawName}${attributes.length ? ` ${attributes.join(' ')}` : ''}${node.startTag.selfClosing ? ' />' : '>'}`;
    if (!node.endTag) {
        return node.startTag.selfClosing ? fixer.replaceText(node.startTag, opening) : null;
    }

    let content = node.children.map((child) => child.type === 'VText'
        ? sourceCode.getText(child).replace(/[\t \r\n]+/g, ' ')
        : interpolations.get(child) ?? sourceCode.getText(child)).join('');

    // Remove newline padding for standalone elements, as in <Description>\ntext\n</Description>.
    // Inline elements keep boundary spaces so adjacent words are not joined.
    const before = sourceCode.lines[node.loc.start.line - 1].slice(0, node.loc.start.column);
    const after = sourceCode.lines[node.loc.end.line - 1].slice(node.loc.end.column);
    if (!before.trim() && !after.trim()) {
        const first = node.children[0];
        const last = node.children.at(-1);
        if (first?.type === 'VText' && /^[\t ]*[\r\n]/.test(sourceCode.getText(first))) content = content.trimStart();
        if (last?.type === 'VText' && /[\r\n][\t ]*$/.test(sourceCode.getText(last))) content = content.trimEnd();
    }
    if (!content.trim()) content = '';

    return [
        fixer.replaceText(node.startTag, opening),
        fixer.replaceTextRange([node.startTag.range[1], node.endTag.range[0]], content),
        fixer.replaceText(node.endTag, sourceCode.getText(node.endTag).replace(/[\t \r\n]+(?=>)/g, '')),
    ];
}

function checkMultiLine(context, node) {
    if (!node.startTag.selfClosing && !node.endTag) return;

    const sourceCode = context.sourceCode;
    const content = node.endTag ? sourceCode.text.slice(node.startTag.range[1], node.endTag.range[0]) : '';
    const leadingNewline = /^[\t ]*(?:\r\n|\r|\n)/.test(content);
    const trailingNewline = /(?:\r\n|\r|\n)[\t ]*$/.test(content);
    if (leadingNewline && trailingNewline) return;

    context.report({
        loc: node.loc,
        messageId: 'multiLine',
        data: {element: node.rawName},
        fix(fixer) {
            if (preservesWhitespace(node)) return null;

            const newline = sourceCode.text.includes('\r\n') ? '\r\n' : '\n';
            const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/)[0];
            const parentIndent = node.parent?.type === 'VElement'
                ? sourceCode.lines[node.parent.loc.start.line - 1].match(/^[\t ]*/)[0]
                : '';
            const indentUnit = indent.startsWith(parentIndent) && indent.length > parentIndent.length
                ? indent.slice(parentIndent.length)
                : indent.includes('\t') ? '\t' : '    ';

            if (node.startTag.selfClosing) {
                const ending = sourceCode.getText(node.startTag).match(/[\t ]*\/>$/);
                if (!ending) return null;
                return fixer.replaceTextRange(
                    [node.startTag.range[1] - ending[0].length, node.startTag.range[1]],
                    `>${newline}${indent}</${node.rawName}>`,
                );
            }

            const start = node.startTag.range[1];
            const end = node.endTag.range[0];
            if (!content.trim()) return fixer.replaceTextRange([start, end], `${newline}${indent}`);

            const fixes = [];
            if (!leadingNewline) {
                const spaces = content.match(/^[\t ]*/)[0].length;
                fixes.push(fixer.replaceTextRange([start, start + spaces], `${newline}${indent}${indentUnit}`));
            }
            if (!trailingNewline) {
                const spaces = content.match(/[\t ]*$/)[0].length;
                fixes.push(fixer.replaceTextRange([end - spaces, end], `${newline}${indent}`));
            }
            return fixes;
        },
    });
}

function singleLineAttribute(sourceCode, attribute) {
    const original = sourceCode.getText(attribute);
    if (!/[\r\n\u2028\u2029]/u.test(original)) return original;

    const value = attribute.value;
    const expression = value?.expression;
    const key = sourceCode.getText(attribute.key);
    if (!attribute.directive || !expression || /[\r\n\u2028\u2029]/u.test(key)) return undefined;

    const raw = sourceCode.getText(value);
    if (!['"', "'"].includes(raw[0]) || raw.at(-1) !== raw[0]) return undefined;

    // Multiple event-handler statements may depend on automatic semicolon insertion.
    if (expression.type === 'VOnExpression'
        && (expression.body.length !== 1 || expression.body[0].type !== 'ExpressionStatement')) return undefined;

    const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore();
    const parts = tokenStore.getTokens(value, {includeComments: true});
    if (parts.some((token) => ['Line', 'Block', 'HTMLComment'].includes(token.type)
        || /[\r\n\u2028\u2029]/u.test(sourceCode.getText(token)))) return undefined;

    const trailingCommas = new Set();
    const pending = [expression.type === 'VOnExpression' ? expression.body[0].expression : expression];

    while (pending.length) {
        const node = pending.pop();
        if (!sourceCode.visitorKeys[node.type]
            || ['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression'].includes(node.type)) return undefined;

        if (node.type === 'ObjectExpression' || (node.type === 'ArrayExpression' && node.elements.at(-1) !== null)) {
            const closing = tokenStore.getLastToken(node);
            const previous = closing && tokenStore.getTokenBefore(closing);
            if (previous?.value === ',') trailingCommas.add(previous.range[0]);
        }

        for (const name of sourceCode.visitorKeys[node.type] ?? []) {
            const children = Array.isArray(node[name]) ? node[name] : [node[name]];
            pending.push(...children.filter((child) => child?.type));
        }
    }

    const kept = parts.filter((token) => !trailingCommas.has(token.range[0]));
    let compact = '';

    for (let index = 0; index < kept.length; index++) {
        const token = kept[index];
        if (index) {
            const previous = kept[index - 1];
            let gap = sourceCode.text.slice(previous.range[1], token.range[0]);
            const removedComma = [...trailingCommas].some((start) => start >= previous.range[1] && start < token.range[0]);

            if (removedComma || /[\r\n\u2028\u2029]/u.test(gap)) {
                if (!/^[\t \r\n\f\u2028\u2029,]*$/u.test(gap)) return undefined;
                const tight = index === 1 || index === kept.length - 1
                    || (previous.type === 'Punctuator' && ['(', '[', '.', '?.'].includes(previous.value))
                    || (token.type === 'Punctuator' && [')', ']', '.', '?.', ',', ';', ':'].includes(token.value))
                    || (previous.value === '{' && token.value === '}');
                gap = tight ? '' : ' ';
            }

            compact += gap;
        }
        compact += sourceCode.getText(token);
    }

    return `${key}=${compact}`;
}

function checkAttributeLayout(context, instance) {
    const {node, entry} = instance;
    const {startTag} = node;
    const attributes = startTag.attributes;
    const countBased = entry.attributeMultilineAt !== undefined;
    const oneLine = entry.attributeLayout === 'single-liner-attributes' || (countBased && attributes.length < entry.attributeMultilineAt);
    if (oneLine && startTag.loc.start.line === startTag.loc.end.line) return;
    if (!oneLine && !attributes.length) return;

    const sourceCode = context.sourceCode;
    const closing = sourceCode.parserServices.getTemplateBodyTokenStore?.().getLastToken(startTag);
    if (!closing || !['>', '/>'].includes(sourceCode.getText(closing))) return;
    const newline = sourceCode.text.includes('\r\n') ? '\r\n' : '\n';
    const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/)[0];
    const parentIndent = node.parent?.type === 'VElement'
        ? sourceCode.lines[node.parent.loc.start.line - 1].match(/^[\t ]*/)[0]
        : '';
    const indentUnit = indent.startsWith(parentIndent) && indent.length > parentIndent.length
        ? indent.slice(parentIndent.length)
        : indent.includes('\t') ? '\t' : '    ';
    const gaps = [];
    let end = startTag.range[0] + node.rawName.length + 1;

    for (const attribute of attributes) {
        gaps.push({range: [end, attribute.range[0]], text: oneLine ? ' ' : newline + indent + indentUnit});
        end = attribute.range[1];
    }
    gaps.push({range: [end, closing.range[0]], text: startTag.selfClosing ? ' ' : ''});
    const edits = gaps.filter(({range, text}) => sourceCode.text.slice(...range) !== text);
    let attributesSafe = true;

    if (oneLine) {
        for (const attribute of attributes) {
            if (multilineClassArray(attribute)) {
                // Keep the old unconditional flag's class-array exception. The
                // count-based flag is strict: conflicting multiline class values
                // remain reported, without fighting their own formatting rule.
                if (countBased && attribute.loc.start.line !== attribute.loc.end.line) attributesSafe = false;
                continue;
            }
            const compact = singleLineAttribute(sourceCode, attribute);
            if (compact === undefined) {
                attributesSafe = false;
            } else if (compact !== sourceCode.getText(attribute)) {
                edits.push({range: attribute.range, text: compact});
            }
        }
    }
    if (!oneLine && !edits.length) return;
    if (oneLine && !edits.length && attributes.every((attribute) => attribute.loc.start.line === attribute.loc.end.line || (!countBased && multilineClassArray(attribute)))) return;

    const lineSensitive = countBased && sourceCode.lines.slice(Math.max(0, startTag.loc.start.line - 2), startTag.loc.end.line)
        .some((line) => /eslint-(?:disable|enable)-(?:next-line|line)\b/u.test(line));
    const safe = !preservesWhitespace(node) && !lineSensitive
        && gaps.every(({range}) => /^[\t \r\n\f]*$/.test(sourceCode.text.slice(...range)))
        && attributesSafe;

    context.report({
        loc: startTag.loc,
        messageId: oneLine ? 'oneLineAttributes' : 'multiLineAttributes',
        data: {element: node.rawName},
        fix: safe && edits.length ? (fixer) => edits.map(({range, text}) => fixer.replaceTextRange(range, text)) : undefined,
    });
}

export function checkComponentLayout(context, instance) {
    if (instance.entry.attributeLayout) checkAttributeLayout(context, instance);
    if (instance.entry.selfClosing && !instance.node.startTag.selfClosing) {
        const {node} = instance;
        const sourceCode = context.sourceCode;
        const empty = node.endTag && /^[\t \r\n\f]*$/.test(sourceCode.text.slice(node.startTag.range[1], node.endTag.range[0]));
        context.report({
            loc: node.startTag.loc,
            messageId: empty ? 'selfClosing' : 'selfClosingContent',
            data: {element: node.rawName},
            fix: empty && !preservesWhitespace(node) ? (fixer) => {
                const closing = node.startTag.range[1] - 1;
                const space = /\s/.test(sourceCode.text[closing - 1]) ? '' : ' ';
                return fixer.replaceTextRange([closing, node.endTag.range[1]], `${space}/>`);
            } : undefined,
        });
    }
    if (instance.entry.layout === 'multi-liner') {
        checkMultiLine(context, instance.node);
    } else if (['single-liner', 'single-liner:unless-child-elements'].includes(instance.entry.layout)
        && instance.entry.attributeLayout !== 'multi-liner-attributes'
        && instance.node.startTag.loc.start.line === instance.node.startTag.loc.end.line
        && !instance.node.children.some((child) => child.type === 'VElement')
        && instance.node.loc.end.line - instance.node.loc.start.line > classArrayLines(instance.node)) {
        context.report({
            loc: instance.node.loc,
            messageId: 'oneLine',
            data: {element: instance.node.rawName},
            fix: (fixer) => fixOneLine(fixer, context.sourceCode, instance.node),
        });
    }
}
