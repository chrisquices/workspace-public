import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/draggable',
    factoryName: 'createDraggable',
    configOrder: [
        'enabled',
        {position: ['x', 'y']},
        {size: ['width', 'height']},
        {drag: ['handle', 'axis', {bounds: ['top', 'left', 'right', 'bottom']}, 'threshold']},
        {resize: ['enabled', 'handles', {limits: ['minWidth', 'minHeight', 'maxWidth', 'maxHeight']}, 'aspectRatio', 'edgeSize']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved draggable engine order.',
        includeInReadme: true,
    },
};
