import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const functionTypes = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'TSDeclareFunction',
    'TSEmptyBodyFunctionExpression',
]);

function definedFunction(node) {
    const declaration = node.declaration ?? node;

    if (functionTypes.has(declaration.type)) {
        return declaration;
    }

    if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
            const value = unwrapExpression(declarator.init);

            if (functionTypes.has(value?.type)) {
                return value;
            }
        }
    }

    const value = unwrapExpression(declaration.value);

    return functionTypes.has(value?.type) ? value : null;
}

export default {
    meta: {
        type: 'layout',
        description: 'Require blank lines before and after function definitions beside other statements or members, including nested and exported functions, function-valued declarations, and object or class methods. Keep documentation attached and TypeScript overloads grouped.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Separate this function definition or method from its neighboring statement or member with a blank line. Keep leading documentation and trailing comments attached. Count only blank lines outside comments; do not add padding against enclosing braces.',
            manual: 'Add a blank line around this function definition manually while preserving the intervening line directive. Keep the directive with its intended target and documentation with its declaration.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const template = sourceCode.ast.templateBody;
        const templateTokens = sourceCode.parserServices.getTemplateBodyTokenStore?.();
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function tokensFor(node) {
            if (template && templateTokens && node.range[0] >= template.range[0] && node.range[1] <= template.range[1]) {
                return templateTokens;
            }

            return sourceCode;
        }

        function continuesOverload(previous, current, previousFunction) {
            if (previousFunction.body) {
                return false;
            }

            const before = previous.declaration ?? previous;
            const after = current.declaration ?? current;
            const previousName = before.id?.name ?? getStaticPropertyName(before) ?? (before.key && sourceCode.getText(before.key));
            const currentName = after.id?.name ?? getStaticPropertyName(after) ?? (after.key && sourceCode.getText(after.key));

            return previousName !== null && previousName !== undefined && previousName === currentName
                && before.static === after.static && before.kind === after.kind;
        }

        function checkFunctions(node) {
            const nodes = node.body ?? node.properties ?? node.consequent;

            for (let index = 1; index < nodes.length; index++) {
                const previous = nodes[index - 1];
                const current = nodes[index];
                const previousFunction = definedFunction(previous);
                const currentFunction = definedFunction(current);

                if ((!previousFunction && !currentFunction)
                    || (previousFunction && currentFunction && continuesOverload(previous, current, previousFunction))) {
                    continue;
                }
                if (node.type === 'Program' && scripts && !scripts.some((script) =>
                    script.startTag.range[1] <= previous.range[0]
                    && current.range[1] <= (script.endTag?.range[0] ?? script.range[1]))) continue;

                const comments = tokensFor(current).getCommentsBefore(current).filter(function (comment) {
                    return comment.range[0] >= previous.range[1];
                });
                const boundaries = [previous, ...comments, current];
                const separated = boundaries.slice(1).some(function (next, boundaryIndex) {
                    const before = boundaries[boundaryIndex];

                    return sourceCode.lines.slice(before.loc.end.line, next.loc.start.line - 1).some(function (line) {
                        return line.trim() === '';
                    });
                });

                if (separated) {
                    continue;
                }

                const anchor = comments.find(function (comment) {
                    return comment.loc.start.line > previous.loc.end.line
                        || (comment.type === 'Block' && sourceCode.getText(comment).startsWith('/**'));
                }) ?? current;
                const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];
                const safe = !comments.some(function (comment) {
                    return comment.loc.start.line === previous.loc.end.line && isLineDirective(comment);
                });

                context.report({
                    node: current,
                    messageId: safe ? 'spacing' : 'manual',
                    fix(fixer) {
                        if (!safe) {
                            return null;
                        }

                        if (anchor.loc.start.line === beforeAnchor.loc.end.line) {
                            const between = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]);
                            const whitespace = between.match(/\s*$/u)[0];
                            const indentation = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];

                            return fixer.replaceTextRange([anchor.range[0] - whitespace.length, anchor.range[0]], newline + newline + indentation);
                        }

                        const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });

                        return fixer.insertTextBeforeRange([start, start], newline);
                    },
                });
            }
        }

        const visitor = {
            Program: checkFunctions,
            BlockStatement: checkFunctions,
            StaticBlock: checkFunctions,
            TSModuleBlock: checkFunctions,
            ClassBody: checkFunctions,
            ObjectExpression: checkFunctions,
            SwitchCase: checkFunctions,
            VOnExpression: checkFunctions,
        };

        return sourceCode.parserServices.defineTemplateBodyVisitor?.(visitor, visitor) ?? visitor;
    },
};
