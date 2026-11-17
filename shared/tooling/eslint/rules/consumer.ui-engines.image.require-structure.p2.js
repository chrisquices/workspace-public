import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/image',
    factoryName: 'createImage',
    configOrder: [
        'src',
        {document: ['width', 'height', 'background']},
        {viewport: [
            'element', 'fit',
            {zoom: ['value', 'min', 'max', 'step', {wheel: ['enabled']}, {pinch: ['enabled']}, {doubleClick: ['enabled']}]},
            {pan: [{offset: ['x', 'y']}, 'bounds', {dragPan: ['enabled']}]},
            {rotation: ['value', 'step']},
            {flip: [{horizontal: ['enabled']}, {vertical: ['enabled']}]},
        ]},
        {shortcuts: ['enabled']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved image engine order.',
        includeInReadme: true,
    },
};
