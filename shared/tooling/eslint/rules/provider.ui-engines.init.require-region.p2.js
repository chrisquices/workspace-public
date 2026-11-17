import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';

const rule = createUiEngineRegionRule({
    name: 'Init',
    after: 'Configuration',
    index: 1,
    methods: ['init'],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place one Init region after Configuration containing one init function.',
        includeInReadme: true,
    },
};
