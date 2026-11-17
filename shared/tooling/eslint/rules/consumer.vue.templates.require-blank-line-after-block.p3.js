import { createVueBlockSpacingRule } from '#eslint/helpers/create-vue-block-spacing-rule.js';

const rule = createVueBlockSpacingRule('template');

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Separate a template block from the next Vue block with a blank line.',
        includeInReadme: false,
    },
};
