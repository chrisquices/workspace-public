import { getPreviousNonWhitespaceToken } from '#eslint/helpers/get-previous-non-whitespace-token.js';

export function checkComponentSpacing(context, instance) {
    const checkEntries = instance.entries && !instance.outOfOrder && !instance.unexpected.length && !instance.choices.length;
    const rootSpacing = !instance.parent && (instance.entry.blankLineBeforeRoot || instance.entry.blankLineAfterRoot);
    const siblingSpacing = instance.entry.blankLineAfterIfNextSibling;
    if (!checkEntries && !rootSpacing && !siblingSpacing && !instance.entry.blankLineBetweenChildren && !instance.entry.noBlankLineBetweenChildren) return;

    const sourceCode = context.sourceCode;
    const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore?.();
    if (!tokenStore) return;

    const boundaries = [];
    const siblingNode = instance.afterNode;
    if ((rootSpacing || siblingSpacing) && siblingNode.parent?.type === 'VElement') {
        const parent = siblingNode.parent;
        const siblings = parent.children.filter((child) => child.type === 'VElement' || child.type === 'VExpressionContainer'
            || (child.type === 'VText' && child.value.trim()));
        const index = siblings.indexOf(siblingNode);
        if (rootSpacing && instance.entry.blankLineBeforeRoot) {
            boundaries.push({left: siblings[index - 1] ?? parent.startTag, right: instance.node, edge: true});
        }
        if (siblingSpacing && siblings[index + 1]) {
            boundaries.push({left: siblingNode, right: siblings[index + 1], afterSibling: true});
        }
        if (rootSpacing && instance.entry.blankLineAfterRoot) {
            boundaries.push({left: instance.node, right: siblings[index + 1] ?? parent.endTag, edge: true});
        }
    }
    let preservesWhitespace = false;
    for (let node = instance.node; node?.type === 'VElement'; node = node.parent) {
        if (['pre', 'textarea', 'script', 'style'].includes(node.rawName)
            || node.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) {
            preservesWhitespace = true;
            break;
        }
    }
    if (!instance.external && instance.entry.noBlankLineBetweenChildren && instance.node.endTag) {
        const element = instance.node;
        const start = element.startTag.range[1];
        const end = element.endTag.range[0];
        const content = sourceCode.text.slice(start, end);
        const opening = content.match(/^(?:[\t ]*(?:\r?\n|\r(?!\n))){2,}[\t ]*/u)?.[0];
        const closing = content.match(/(?:[\t ]*(?:\r?\n|\r(?!\n))){2,}[\t ]*$/u)?.[0];
        const children = element.children.filter((child) => child.type !== 'VText' || !/^\s*$/u.test(child.value));

        if (opening) {
            const safe = !preservesWhitespace && children[0]?.type === 'VElement' && children[0].range[0] === start + opening.length;
            const newline = opening.match(/\r\n|\r|\n/u)[0];
            const indentation = opening.split(/\r\n|\r|\n/u).at(-1);
            context.report({
                node: element.startTag,
                messageId: 'noEdgeSpacing',
                data: {element: element.rawName},
                fix: safe ? (fixer) => fixer.replaceTextRange([start, start + opening.length], newline + indentation) : undefined,
            });
        }

        if (closing && closing.length !== content.length) {
            const safe = !preservesWhitespace && children.at(-1)?.type === 'VElement' && children.at(-1).range[1] === end - closing.length;
            const newline = closing.match(/\r\n|\r|\n/u)[0];
            const indentation = closing.split(/\r\n|\r|\n/u).at(-1);
            context.report({
                node: element.endTag,
                messageId: 'noEdgeSpacing',
                data: {element: element.rawName},
                fix: safe ? (fixer) => fixer.replaceTextRange([end - closing.length, end], newline + indentation) : undefined,
            });
        }
    }
    if (!instance.external && (instance.entry.blankLineBetweenChildren || instance.entry.noBlankLineBetweenChildren)) {
        const children = instance.node.children.filter((child) => child.type === 'VElement');
        for (let index = 1; index < children.length; index++) {
            boundaries.push({left: children[index - 1], right: children[index], betweenChildren: true, noBlankLine: instance.entry.noBlankLineBetweenChildren});
        }
    }
    // Explicit BlankLine entries depend on a valid match; the parent flag uses actual children.
    if (checkEntries && instance.entry.unordered) {
        const children = [...instance.children].sort((a, b) => a.node.range[0] - b.node.range[0]);
        for (const [index, child] of children.entries()) {
            if (child.entry.blankLine?.required) {
                boundaries.push({left: children[index - 1]?.afterNode ?? instance.node.startTag, right: child.beforeNode});
            }
            if (child.entry.blankLineAfter?.required) {
                boundaries.push({left: child.afterNode, right: children[index + 1]?.beforeNode ?? instance.node.endTag, edge: true});
            }
        }
    } else if (checkEntries) {
        const entries = instance.entries;
        const matched = new Map();
        for (const child of instance.children) {
            const group = matched.get(child.entry);
            if (group) group.last = child.afterNode;
            else matched.set(child.entry, {first: child.beforeNode, last: child.afterNode});
        }

        for (const [index, entry] of entries.entries()) {
            if (entry.name !== 'BlankLine' || !entry.required) continue;
            const before = entries.slice(0, index).reverse().find((candidate) => matched.has(candidate));
            const after = entries.slice(index + 1).find((candidate) => matched.has(candidate));
            // Explicit list edges use the parent's tags. Interior separators
            // still disappear when their optional neighboring components do.
            const declaredBefore = entries.slice(0, index).some((candidate) => !candidate.special && !candidate.forbidden);
            const declaredAfter = entries.slice(index + 1).some((candidate) => !candidate.special && !candidate.forbidden);
            if ((!before && declaredBefore) || (!after && declaredAfter) || (!before && !after)) continue;
            boundaries.push({
                left: before ? matched.get(before).last : instance.node.startTag,
                right: after ? matched.get(after).first : instance.node.endTag,
                edge: !before || !after,
            });
        }
    }

    const checked = new Set();
    for (const {left, right, betweenChildren, noBlankLine, edge, afterSibling} of boundaries) {
        if (!left || !right) continue;
        if (checked.has(right)) continue;
        checked.add(right);

        if (noBlankLine) {
            const tokens = tokenStore.getTokensBetween(left, right, {includeComments: true});
            const comments = tokens.filter((token) => token.type === 'HTMLComment');
            const gaps = [];
            let start = left.range[1];
            for (const comment of comments) {
                gaps.push(sourceCode.text.slice(start, comment.range[0]));
                start = comment.range[1];
            }
            gaps.push(sourceCode.text.slice(start, right.range[0]));
            // Blank lines inside a comment are its content, not sibling spacing.
            if (!gaps.some((gap) => gap.split(/\r\n|\n|\r/).slice(1, -1).some((line) => /^[\t ]*$/.test(line)))) continue;

            const gap = sourceCode.text.slice(left.range[1], right.range[0]);
            const safe = !preservesWhitespace && /^[\t \r\n]*$/.test(gap)
                && tokens.every((token) => token.type === 'HTMLWhitespace');
            const newline = gap.match(/\r\n|\n|\r/)[0];
            const indentation = gap.split(/\r\n|\n|\r/).at(-1);
            context.report({
                loc: right.startTag.loc,
                messageId: 'noSpacing',
                data: {before: left.rawName, after: right.rawName},
                // Comments may require their own blank line; leave those conflicts for an explicit edit.
                fix: safe ? (fixer) => fixer.replaceTextRange([left.range[1], right.range[0]], newline + indentation) : undefined,
            });
            continue;
        }

        let anchor = right;
        // Keep leading standalone comments attached to the following component.
        while (true) {
            const comment = getPreviousNonWhitespaceToken(tokenStore, anchor);
            if (comment?.type !== 'HTMLComment' || comment.range[0] < left.range[1]
                || comment.loc.end.line >= anchor.loc.start.line
                || sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim()
                || !/^\s*$/.test(sourceCode.text.slice(comment.range[1], anchor.range[0]))) break;
            anchor = comment;
        }

        const end = anchor.range[0];
        const gap = sourceCode.text.slice(left.range[1], end).match(/\s*$/)[0];
        if ((gap.match(/\r\n|\n|\r/g) ?? []).length === 2) continue;

        const newline = sourceCode.text.match(/\r\n|\n|\r/u)?.[0] ?? '\n';
        const indentation = gap.split(/\r\n|\n|\r/).at(-1);
        const markupBoundary = ['VElement', 'VStartTag', 'VEndTag'];
        const lineSensitive = sourceCode.lines.slice(Math.max(0, left.loc.end.line - 2), anchor.loc.start.line)
            .some((line) => /eslint-(?:disable|enable)-(?:next-line|line)\b/u.test(line));
        const safe = !preservesWhitespace && !lineSensitive
            && markupBoundary.includes(left.type) && markupBoundary.includes(right.type)
            && tokenStore.getTokensBetween(left, right, {includeComments: true})
                .every((token) => ['HTMLWhitespace', 'HTMLComment'].includes(token.type));
        context.report({
            loc: right.startTag?.loc ?? right.loc,
            messageId: afterSibling ? 'siblingSpacing' : edge ? 'edgeSpacing' : instance.entry.unordered && !betweenChildren ? 'spacingAbove' : 'spacing',
            data: {before: left.rawName, after: right.rawName, element: instance.node.rawName},
            fix: safe ? (fixer) => fixer.replaceTextRange([end - gap.length, end], newline + newline + indentation) : undefined,
        });
    }
}
