import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/dropzone',
    factoryName: 'createDropzone',
    configOrder: [
        'enabled',
        {files: ['accept', 'exclude', {limits: ['minSize', 'maxSize', 'maxFiles', 'maxTotalSize']}, {multiple: ['enabled']}, {dedupe: ['enabled']}]},
        {picker: [{openOnClick: ['enabled']}]},
        {previews: [{video: ['enabled']}]},
        {thumbnails: [{image: ['enabled']}, {video: ['enabled']}, {audio: ['enabled']}]},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved dropzone engine order.',
        includeInReadme: true,
    },
};
