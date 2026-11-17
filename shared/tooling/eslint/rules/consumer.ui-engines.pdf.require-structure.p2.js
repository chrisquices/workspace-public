import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/pdf',
    factoryName: 'createPdf',
    configOrder: [
        'source',
        'page',
        {viewport: ['element', 'fit', 'rotation', {zoom: ['value', 'min', 'max', 'step']}, {rendering: ['pixelRatio', 'maxCanvasPixels']}]},
        {shortcuts: ['enabled']},
        {request: ['password', 'httpHeaders', 'withCredentials']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved pdf engine order.',
        includeInReadme: true,
    },
};
