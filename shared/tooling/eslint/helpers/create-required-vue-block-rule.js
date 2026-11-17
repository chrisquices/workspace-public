import { getVueBlocks } from './get-vue-blocks.js';

export function createRequiredVueBlockRule(name) {
    return {
        meta: {
            type: 'suggestion',
            docs: { description: `Require a top-level <${name}> block in every consumer Vue file, even when empty.` },
            fixable: 'code',
            schema: [],
            messages: {
                missingBlock: `Missing required top-level <${name}> block. Add it even if empty, keeping script before template before style.`,
            },
        },

        create(context) {
            const vue = getVueBlocks(context);

            if (!vue) {
                return {};
            }

            return {
                Program() {
                    const { sourceCode, blocks, blockNames, newline } = vue;

                    if (blocks.some(function (block) { return block.rawName === name; })) {
                        return;
                    }

                    context.report({
                        loc: { line: 1, column: 0 },
                        messageId: 'missingBlock',
                        fix(fixer) {
                            if (!vue.canFixStructure) {
                                return null;
                            }

                            const openingTag = name === 'script' ? '<script setup lang="ts">' : `<${name}>`;
                            const emptyBlock = `${openingTag}</${name}>`;
                            const nextBlock = blocks.find(function (block) {
                                return blockNames.indexOf(block.rawName) > blockNames.indexOf(name);
                            });

                            if (nextBlock) {
                                return fixer.insertTextBeforeRange(nextBlock.range, `${emptyBlock}${newline}${newline}`);
                            }

                            const lastBlock = blocks.at(-1);

                            if (lastBlock) {
                                return fixer.insertTextAfterRange(lastBlock.range, `${newline}${newline}${emptyBlock}`);
                            }

                            const separator = sourceCode.text && !sourceCode.text.endsWith('\n') ? newline : '';

                            return fixer.insertTextAfterRange([0, sourceCode.text.length], `${separator}${emptyBlock}${newline}`);
                        },
                    });
                },
            };
        },
    };
}
