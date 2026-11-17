import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';

const rule = createUiEngineRegionRule({
    name: 'Reactive Configuration',
    after: 'State',
    index: 4,
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place Reactive Configuration immediately after State as the fifth engine region.',
        includeInReadme: true,
    },
};
