// Normalize complete standalone closing comments. Preserve the comment syntax
// and indentation. Inline or multiline markers require a manual layout change.

import { codeRegionMessages, createCodeRegionVisitor } from '#eslint/helpers/create-code-region-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Close regions with standalone lowercase endregion comments without titles or dashes.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            ...codeRegionMessages,
            format: 'Close the region with a standalone {{example}} comment. Use lowercase endregion with the correct comment delimiters and no title or dash padding. Reposition inline or multiline markers manually while preserving neighboring code.',
        },
    },

    create(context) {
        return createCodeRegionVisitor(context, function (regions) {
            for (const region of regions) {
                const example = `${region.opening} endregion${region.ending}`;

                if (!region.isOpening && (!region.standalone || region.raw !== example)) {
                    context.report({
                        loc: region.comment.loc,
                        messageId: 'format',
                        data: { example: example },
                        fix(fixer) {
                            return region.standalone ? fixer.replaceTextRange(region.comment.range, example) : null;
                        },
                    });
                }
            }
        });
    },
};
