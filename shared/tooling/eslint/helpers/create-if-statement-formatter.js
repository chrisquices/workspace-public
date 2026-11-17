import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export function createIfStatementFormatter(context) {
    const sourceCode = context.sourceCode;
    const template = sourceCode.ast.templateBody;
    const templateTokens = sourceCode.parserServices.getTemplateBodyTokenStore?.();
    const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

    function tokensFor(node) {
        if (template && templateTokens && node.range[0] >= template.range[0] && node.range[1] <= template.range[1]) {
            return templateTokens;
        }

        return sourceCode;
    }

    function indentation(node) {
        return sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
    }

    function hasSensitiveComments(node) {
        const tokens = tokensFor(node);
        const comments = [
            ...tokens.getCommentsInside(node),
            ...tokens.getCommentsBefore(node).filter(function (comment) {
                return comment.loc.end.line >= node.loc.start.line - 1;
            }),
            ...tokens.getCommentsAfter(node).filter(function (comment) {
                return comment.loc.start.line === node.loc.end.line;
            }),
        ];

        return comments.some(isLineDirective);
    }

    function chainRoot(node) {
        while (node.parent?.type === 'IfStatement' && node.parent.alternate === node) {
            node = node.parent;
        }

        return node;
    }

    function branches(node) {
        return node.alternate && node.alternate.type !== 'IfStatement'
            ? [node.consequent, node.alternate] : [node.consequent];
    }

    function singleLineLength(node) {
        return Array.from(indentation(node) + sourceCode.getText(node)).length;
    }

    function wrapBranchEdits(node, branch) {
        const tokens = tokensFor(branch);
        const header = tokens.getTokenBefore(branch);
        const gap = [header.range[1], branch.range[0]];

        if (sourceCode.text.slice(...gap).trim() !== '' || branch.type === 'FunctionDeclaration' || hasSensitiveComments(node)) {
            return null;
        }

        const base = indentation(node);
        const existingIndent = indentation(branch);
        const bodyIndent = branch.loc.start.line > header.loc.end.line && existingIndent.length > base.length
            ? existingIndent : base + '    ';
        const trailing = tokens.getCommentsAfter(branch).filter(function (comment) {
            return comment.loc.start.line === branch.loc.end.line;
        });
        const end = trailing.at(-1)?.range[1] ?? branch.range[1];

        return [
            { range: gap, text: ` {${newline}${bodyIndent}` },
            { range: [end, end], text: `${newline}${base}}` },
        ];
    }

    function blockLineEdits(node, branch) {
        const tokens = tokensFor(branch);
        const opening = tokens.getFirstToken(branch);
        const closing = tokens.getLastToken(branch);
        const first = tokens.getTokenAfter(opening, { includeComments: true });
        const last = tokens.getTokenBefore(closing, { includeComments: true });
        const empty = first.range[0] === closing.range[0];
        const needsStart = opening.loc.end.line === first.loc.start.line;
        const needsEnd = last.loc.end.line === closing.loc.start.line;

        if (!needsStart && !needsEnd) {
            return [];
        }

        if (hasSensitiveComments(node)) {
            return null;
        }

        const base = indentation(node);

        if (empty) {
            return [{ range: [opening.range[1], closing.range[0]], text: newline + base }];
        }

        const indentedStatement = branch.body.find(function (statement) {
            return statement.loc.start.line > opening.loc.end.line && indentation(statement).length > base.length;
        });
        const bodyIndent = indentedStatement ? indentation(indentedStatement) : base + '    ';
        const edits = [];

        if (needsStart) {
            edits.push({ range: [opening.range[1], first.range[0]], text: newline + bodyIndent });
        }

        if (needsEnd) {
            edits.push({ range: [last.range[1], closing.range[0]], text: newline + base });
        }

        return edits;
    }

    function inlinePlacementEdits(previous, next, node) {
        const range = [previous.range[1], next.range[0]];
        const gap = sourceCode.text.slice(...range);
        const hasComments = gap.trim() !== '';

        if (previous.loc.end.line === next.loc.start.line && (gap === ' ' || hasComments)) {
            return [];
        }

        if (hasComments || hasSensitiveComments(node)) {
            return null;
        }

        return [{ range: range, text: ' ' }];
    }

    function applyEdits(fixer, edits) {
        if (edits === null) {
            return null;
        }

        return edits.map(function (edit) {
            return fixer.replaceTextRange(edit.range, edit.text);
        });
    }

    function visitor(listeners) {
        return sourceCode.parserServices.defineTemplateBodyVisitor?.(listeners, listeners) ?? listeners;
    }

    return {
        newline: newline,
        tokensFor: tokensFor,
        indentation: indentation,
        chainRoot: chainRoot,
        branches: branches,
        singleLineLength: singleLineLength,
        wrapBranchEdits: wrapBranchEdits,
        blockLineEdits: blockLineEdits,
        inlinePlacementEdits: inlinePlacementEdits,
        applyEdits: applyEdits,
        visitor: visitor,
    };
}
