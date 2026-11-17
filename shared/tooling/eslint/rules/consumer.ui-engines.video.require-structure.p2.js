import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/video',
    factoryName: 'createVideo',
    configOrder: [
        'videoId',
        'playerContainer',
        {sources: ['src', 'type']},
        {playback: ['volume', 'muted', 'rate', {autoplay: ['enabled', 'muted']}, {loop: ['enabled']}]},
        'poster',
        {thumbnails: ['src', 'scale']},
        {captions: ['src', 'language', 'label', 'kind', 'default']},
        {caption: ['src', 'language', 'label', 'kind', 'default', 'active', 'readyState']},
        {shortcuts: ['enabled', 'seekStep', 'volumeStep']},
        {touchGestures: ['enabled']},
        {mediaSession: ['title', 'artist', 'album', {artwork: ['src', 'sizes', 'type']}]},
        {watchProgress: ['enabled', 'saveInterval']},
        {persistSettings: ['enabled']},
        {events: ['onChange', 'onError', 'onSingleClick', 'onDoubleClick', 'onSingleTap', 'onDoubleTap']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved video engine order.',
        includeInReadme: true,
    },
};
