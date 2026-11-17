import { createVueBlockSpacingRule } from '#eslint/helpers/create-vue-block-spacing-rule.js';

const rule = createVueBlockSpacingRule('script');

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Separate a script block from the next Vue block with a blank line.',
        includeInReadme: false,
    },
};
