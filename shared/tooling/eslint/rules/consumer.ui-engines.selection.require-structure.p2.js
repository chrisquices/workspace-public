import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/selection',
    factoryName: 'createSelection',
    configOrder: [
        {items: ['count', 'getItemKey', 'selector', 'getItemIndex', 'calculateColumnCount']},
        'mode',
        {shortcuts: ['enabled', {page: ['enabled', 'defaultTarget']}]},
        {click: ['toggleWhenSelected', 'delegate', 'clearOnEmpty']},
        {marquee: ['enabled', 'collectIndicesInRect']},
        {events: ['onChange', 'onError', 'onItemClick', 'onEnter', 'onFocusRequest']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved selection engine order.',
        includeInReadme: true,
    },
};
