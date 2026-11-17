import { codeRegionMessages, createCodeRegionVisitor } from '#eslint/helpers/create-code-region-visitor.js';

const bannerWidth = 120;

export default {
    meta: {
        type: 'layout',
        description: 'Make region opening lines 120 characters wide, including indentation and delimiters.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            ...codeRegionMessages,
            length: 'This region opening contains {{length}} characters. Make the whole line exactly 120 characters, including indentation and comment delimiters, by resizing only the trailing dashes. Shorten the title manually if it cannot fit with at least one trailing dash.',
        },
    },

    create(context) {
        return createCodeRegionVisitor(context, function (regions) {
            for (const region of regions) {
                if (!region.isOpening || !region.standalone || !region.banner || region.raw !== region.canonicalText) {
                    continue;
                }

                const length = Array.from(region.line).length;

                if (length === bannerWidth) {
                    continue;
                }

                const dashCount = region.banner[2].length;
                const requiredDashes = dashCount + bannerWidth - length;
                const dashEnd = region.comment.range[1] - region.ending.length;

                context.report({
                    loc: region.comment.loc,
                    messageId: 'length',
                    data: { length: length },
                    fix(fixer) {
                        return requiredDashes > 0
                            ? fixer.replaceTextRange([dashEnd - dashCount, dashEnd], '-'.repeat(requiredDashes)) : null;
                    },
                });
            }
        });
    },
};
