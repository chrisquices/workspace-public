import { getVueBlocks } from '#eslint/helpers/get-vue-blocks.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Order Vue blocks as script, template, then style.',
        includeInReadme: false,
        fixable: 'code',
        schema: [],
        messages: {
            order: 'Move whole top-level blocks with their contents so script comes first, template second, and style last.',
        },
    },

    create(context) {
        const vue = getVueBlocks(context);

        if (!vue) {
            return {};
        }

        return {
            Program() {
                const { blocks, blockNames, sourceCode } = vue;
                const orderedBlocks = blocks.toSorted(function (left, right) {
                    return blockNames.indexOf(left.rawName) - blockNames.indexOf(right.rawName);
                });
                const firstMismatch = blocks.find(function (block, index) {
                    return block !== orderedBlocks[index];
                });

                if (!firstMismatch) {
                    return;
                }

                context.report({
                    loc: firstMismatch.startTag.loc,
                    messageId: 'order',
                    fix(fixer) {
                        if (!vue.canFixStructure) {
                            return null;
                        }

                        return blocks.flatMap(function (block, index) {
                            return block === orderedBlocks[index]
                                ? [] : [fixer.replaceTextRange(block.range, sourceCode.getText(orderedBlocks[index]))];
                        });
                    },
                });
            },
        };
    },
};
