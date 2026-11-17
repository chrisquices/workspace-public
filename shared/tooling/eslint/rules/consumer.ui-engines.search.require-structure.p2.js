import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/search',
    factoryName: 'createSearch',
    configOrder: [
        {sources: ['id', 'label', 'weight', 'type', 'items', 'collectItems', 'subscribe', 'collectResults']},
        {fields: ['name', 'weight']},
        'query',
        'filters',
        {matching: ['mode', {caseSensitive: ['enabled']}, {diacriticSensitive: ['enabled']}, 'minQueryLength']},
        {results: ['order', 'batchSize']},
        {scheduling: ['debounceMs']},
        {events: ['onChange', 'onError']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved search engine order.',
        includeInReadme: true,
    },
};
