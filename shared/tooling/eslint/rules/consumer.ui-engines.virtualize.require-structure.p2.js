import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/virtualize',
    factoryName: 'createVirtualizer',
    configOrder: [
        {items: ['data', 'count', 'getItemKey']},
        {layout: ['strategy', 'threshold']},
        {viewport: ['scrollElement', 'overscan']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved virtualize engine order.',
        includeInReadme: true,
    },
};
