import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/audio',
    factoryName: 'createAudio',
    configOrder: [
        'audioId',
        'playerContainer',
        {sources: ['src', 'type']},
        {playback: ['volume', 'muted', 'rate', {autoplay: ['enabled']}, {loop: ['enabled']}]},
        {shortcuts: ['enabled', 'seekStep', 'volumeStep']},
        {mediaSession: ['title', 'artist', 'album', {artwork: ['src', 'sizes', 'type']}]},
        {pitch: ['enabled', 'semitones']},
        {watchProgress: ['enabled', 'saveInterval']},
        {persistSettings: ['enabled']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved audio engine order.',
        includeInReadme: true,
    },
};
