import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/droppable',
    factoryName: 'createDroppable',
    configOrder: [
        'getPayload',
        'canDrop',
        {drag: ['threshold', 'suppressClick', 'autoScroll']},
        {events: ['onChange', 'onError', 'onDrop']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved droppable engine order.',
        includeInReadme: true,
    },
};
