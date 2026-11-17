import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';

const rule = createUiEngineRegionRule({
    name: 'State',
    after: 'Event Listeners',
    index: 3,
    methods: ['subscribe', 'notify', 'getState'],
    orderedMethods: true,
    exclusiveMethods: true,
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place State after Event Listeners with subscribe, notify, and getState in order.',
        includeInReadme: true,
    },
};
