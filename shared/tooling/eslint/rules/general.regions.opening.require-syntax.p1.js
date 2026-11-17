import { codeRegionMessages, createCodeRegionVisitor } from '#eslint/helpers/create-code-region-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Use standalone region openings with three dashes, a meaningful title, and trailing dashes.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            ...codeRegionMessages,
            format: 'Use a standalone region opening with this syntax {{example}}. Keep lowercase region, exactly three dashes before a meaningful title, trailing dashes after it, and the correct comment delimiters.',
        },
    },

    create(context) {
        return createCodeRegionVisitor(context, function (regions) {
            for (const region of regions) {
                if (region.isOpening && (!region.standalone || !region.banner || region.raw !== region.canonicalText)) {
                    context.report({
                        loc: region.comment.loc,
                        messageId: 'format',
                        data: { example: `${region.opening} region --- Meaningful Name ---${region.ending}` },
                        fix(fixer) {
                            if (!region.standalone) {
                                return null;
                            }

                            const body = region.raw.slice(region.opening.length,
                                region.ending ? -region.ending.trim().length : undefined).trim();
                            const title = body.replace(/^#?region\b\s*/iu, '')
                                .replace(/^---\s+/u, '').replace(/\s+-+$/u, '').trim();

                            if (!title || /^-/u.test(title)) {
                                return null;
                            }

                            return fixer.replaceTextRange(region.comment.range,
                                `${region.opening} region --- ${title} ---${region.ending}`);
                        },
                    });
                }
            }
        });
    },
};
