import { getVueBlocks } from '#eslint/helpers/get-vue-blocks.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use the setup attribute on top-level Vue script blocks.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            setup: 'Add setup to this script opening tag. For populated scripts, adapt the code to script setup while preserving component behavior. External scripts and conversions that create a second setup block require a manual rewrite.',
        },
    },

    create(context) {
        const vue = getVueBlocks(context);

        if (!vue) {
            return {};
        }

        return {
            Program() {
                for (const block of vue.blocks) {
                    if (block.rawName !== 'script' || block.startTag.attributes.some(function (attribute) {
                        return !attribute.directive && attribute.key.name === 'setup';
                    })) {
                        continue;
                    }

                    context.report({
                        loc: block.startTag.loc,
                        messageId: 'setup',
                        fix(fixer) {
                            if (!vue.canFixEmptyScript(block)) {
                                return null;
                            }

                            const nameEnd = block.startTag.range[0] + '<script'.length;

                            return fixer.insertTextAfterRange([block.startTag.range[0], nameEnd], ' setup');
                        },
                    });
                }
            },
        };
    },
};
