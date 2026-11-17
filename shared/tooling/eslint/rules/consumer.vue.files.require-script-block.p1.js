import { createRequiredVueBlockRule } from '#eslint/helpers/create-required-vue-block-rule.js';

const rule = createRequiredVueBlockRule('script');

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Include a top-level <script> block in every consumer Vue file, even when empty.',
        includeInReadme: false,
    },
};
