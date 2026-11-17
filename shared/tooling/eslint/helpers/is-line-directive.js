// ESLint and TypeScript directives can target the same or next physical line.
// Spacing fixes must keep them with the statements they control.
const lineDirective = /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u;

export function isLineDirective(comment) {
    return lineDirective.test(comment.value);
}
