import { getVueBlocks } from './get-vue-blocks.js';

export function createVueBlockSpacingRule(name) {
    return {
        meta: {
            type: 'layout',
            docs: { description: `Require exactly one blank line between a top-level <${name}> block and the following top-level block.` },
            fixable: 'whitespace',
            schema: [],
            messages: {
                spacing: `Separate the top-level <${name}> block from the following <{{next}}> block with exactly one blank line immediately before <{{next}}>. Preserve block contents and intervening comments.`,
            },
        },

        create(context) {
            const vue = getVueBlocks(context);

            if (!vue) {
                return {};
            }

            return {
                Program() {
                    const { blocks, sourceCode } = vue;
                    const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

                    for (let index = 0; index < blocks.length - 1; index++) {
                        const block = blocks[index];

                        if (block.rawName !== name) {
                            continue;
                        }

                        const next = blocks[index + 1];
                        const between = sourceCode.text.slice(block.range[1], next.range[0]);
                        const whitespace = between.match(/\s*$/u)[0];
                        const indentation = whitespace.match(/[^\S\r\n\u2028\u2029]*$/u)[0];
                        const padding = `${newline}${newline}${indentation}`;

                        if (whitespace === padding) {
                            continue;
                        }

                        context.report({
                            loc: next.startTag.loc,
                            messageId: 'spacing',
                            data: { next: next.rawName },
                            fix(fixer) {
                                return fixer.replaceTextRange([next.range[0] - whitespace.length, next.range[0]], padding);
                            },
                        });
                    }
                },
            };
        },
    };
}
