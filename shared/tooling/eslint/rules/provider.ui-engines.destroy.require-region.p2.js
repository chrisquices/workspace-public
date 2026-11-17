import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';

const rule = createUiEngineRegionRule({
    name: 'Destroy',
    last: true,
    methods: ['destroy'],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place one Destroy region last, containing one destroy function before the final init and return.',
        includeInReadme: true,
    },
};
