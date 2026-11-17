import { isLineDirective } from './is-line-directive.js';

const lineBreak = /[\r\n\u2028\u2029]/u;

// Plan whitespace changes between existing tokens. Preserve comment and literal
// contents, and leave physical-line directives for manual correction. Callers
// restrict collapsed spans to declaration prefixes or empty call delimiters.
export function getLineBreakEdits(sourceCode, first, last, whitespace) {
    const separate = lineBreak.test(whitespace);
    const tokens = [first, ...sourceCode.getTokensBetween(first, last, { includeComments: true }), last];
    const directives = sourceCode.getAllComments().some(function (comment) {
        return comment.loc.end.line >= first.loc.start.line - 1 && comment.loc.start.line <= last.loc.end.line
            && isLineDirective(comment);
    });

    if (directives || (!separate && tokens.some(function (token) {
        return token.type === 'Line' || token.loc.start.line !== token.loc.end.line;
    }))) {
        return null;
    }

    const edits = [];

    for (let index = 1; index < tokens.length; index++) {
        const range = [tokens[index - 1].range[1], tokens[index].range[0]];
        const gap = sourceCode.text.slice(...range);

        if (!/^\s*$/u.test(gap)) {
            return null;
        }

        if (lineBreak.test(gap) !== separate) {
            edits.push({ range: range, text: whitespace });
        }
    }

    return edits;
}
