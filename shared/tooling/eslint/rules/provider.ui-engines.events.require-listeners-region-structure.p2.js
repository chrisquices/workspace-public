import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';

const rule = createUiEngineRegionRule({
    name: 'Event Listeners',
    after: 'Init',
    index: 2,
    constants: ['cleanups'],
    methods: ['registerEventListener', 'registerAllEventListeners'],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place the Event Listeners region after Init with its cleanup collection and registration functions.',
        includeInReadme: true,
    },
};
