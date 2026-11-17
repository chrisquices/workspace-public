import createUiEngineOptionsRule from '#eslint/helpers/create-ui-engine-options-rule.js';

const rule = createUiEngineOptionsRule({
    moduleName: 'workspace-packages/ui-engines/canvas',
    factoryName: 'createCanvas',
    configOrder: [
        'readOnly',
        {document: ['version', 'background', 'shapes', 'groups']},
        {viewport: [
            {camera: ['x', 'y', 'zoom']},
            {wheel: ['mode']},
            {zoom: ['enabled', 'min', 'max', 'step', {pinch: ['enabled']}]},
            {pan: ['enabled', {dragPan: ['enabled']}]},
            {rendering: ['pixelRatio']},
        ]},
        {tools: [
            'activeTool', {select: ['enabled']}, {hand: ['enabled']}, {draw: ['enabled']},
            {eraser: ['enabled']}, {rectangle: ['enabled']}, {ellipse: ['enabled']},
            {diamond: ['enabled']}, {triangle: ['enabled']}, {line: ['enabled']},
            {arrow: ['enabled']}, {text: ['enabled']}, {note: ['enabled']},
        ]},
        {grid: ['enabled', 'size', {dot: ['color', 'size']}, {fade: ['start', 'end']}, {snapping: ['enabled']}]},
        {alignment: ['enabled', {guide: ['color', 'width', 'dash', {pulse: ['duration', 'minOpacity']}]}, {snapping: ['enabled', 'distance']}]},
        {selection: ['marquee', 'outline', {handle: ['fill', 'border', 'size']}]},
        {shapes: [
            {overlap: ['enabled']},
            {text: ['fontFamily', 'fontWeight', 'fontSize', 'color', 'lineHeight', 'align']},
            'fill', {stroke: ['color', 'width', 'dash']},
            {hover: ['fill', {pulse: ['duration', 'minOpacity']}]},
            {selected: ['fill', {pulse: ['duration', 'minOpacity']}]},
            {lock: ['enabled', {icon: ['enabled']}]},
            {label: ['enabled', {text: ['fontFamily', 'fontWeight', 'fontSize', 'color', 'lineHeight']}]},
            {groupLabel: ['enabled', {text: ['fontFamily', 'fontWeight', 'fontSize', 'color', 'lineHeight']}]},
        ]},
        {measurements: ['enabled', 'system', 'baseUnit', 'unitsPerGridSpace', 'display', 'connector', 'precision', {text: ['fontFamily', 'fontSize', 'color']}]},
        {shortcuts: ['enabled']},
        {history: ['enabled', 'limit']},
        {limits: ['maxShapes', 'maxPointsPerShape', 'maxTextLength']},
        {events: ['onChange', 'onError', 'onShapeDoubleClick', 'onLabelDoubleClick', 'onGroupLabelDoubleClick', 'onLockDoubleClick']},
    ],
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Use inline element and config options in the approved canvas engine order.',
        includeInReadme: true,
    },
};
