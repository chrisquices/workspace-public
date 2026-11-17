import { getVueBlocks } from '#eslint/helpers/get-vue-blocks.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use lang="ts" on top-level Vue script blocks.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            lang: 'Set lang="ts" on this script opening tag. For populated or external scripts, review the code and convert it to TypeScript while preserving component behavior.',
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
                    if (block.rawName !== 'script') {
                        continue;
                    }

                    const languages = block.startTag.attributes.filter(function (attribute) {
                        return !attribute.directive && attribute.key.name === 'lang';
                    });

                    if (languages.some(function (attribute) { return attribute.value?.value === 'ts'; })) {
                        continue;
                    }

                    context.report({
                        loc: block.startTag.loc,
                        messageId: 'lang',
                        fix(fixer) {
                            if (!vue.canFixEmptyScript(block)) {
                                return null;
                            }

                            if (languages.length > 0) {
                                return languages.map(function (attribute, index) {
                                    return index === 0 ? fixer.replaceText(attribute, 'lang="ts"') : fixer.remove(attribute);
                                });
                            }

                            const tagEnd = block.startTag.range[1] - (block.startTag.selfClosing ? 2 : 1);

                            return fixer.insertTextBeforeRange([tagEnd, tagEnd], ' lang="ts"');
                        },
                    });
                }
            },
        };
    },
};
