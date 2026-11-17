import { codeRegionMessages, createCodeRegionVisitor } from '#eslint/helpers/create-code-region-visitor.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Match each region opening with a closing marker in the same code section.',
        includeInReadme: true,
        schema: [],
        messages: {
            ...codeRegionMessages,
            unmatchedEnd: 'This endregion line has no matching region opening line in this code section. Add the intended opening line or remove the unmatched closing line. Nest region pairs in opening and closing order.',
            unclosed: 'Close this region with a standalone endregion comment in the same code section, using that section\'s comment syntax. Keep nested region pairs balanced.',
        },
    },

    create(context) {
        return createCodeRegionVisitor(context, function (regions) {
            const stack = [];

            for (const region of regions) {
                if (region.isOpening) {
                    stack.push(region.comment);
                } else if (!stack.pop()) {
                    context.report({ loc: region.comment.loc, messageId: 'unmatchedEnd' });
                }
            }

            for (const opening of stack) {
                context.report({ loc: opening.loc, messageId: 'unclosed' });
            }
        });
    },
};
