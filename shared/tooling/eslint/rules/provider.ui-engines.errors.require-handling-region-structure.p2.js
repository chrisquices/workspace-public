import {trackUiEngineConfigReferences} from '#eslint/helpers/track-ui-engine-config-references.js';
import createUiEngineRegionRule from '#eslint/helpers/create-ui-engine-region-rule.js';
import { isSharedErrorReporterFactory } from '#eslint/helpers/is-shared-error-reporter-factory.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const rule = createUiEngineRegionRule({
    name: 'Error Handling',
    after: 'Reactive Configuration',
    index: 5,
    validateContents(context, contents, region, engine) {
        const {getPath} = trackUiEngineConfigReferences(context, engine);
        const reporters = contents.filter(statement => statement.type === 'VariableDeclaration'
            && ['const', 'let'].includes(statement.kind)).flatMap(statement => statement.declarations)
            .filter(declaration => declaration.id.type === 'Identifier' && declaration.id.name === 'reportError');
        const call = unwrapExpression(reporters[0]?.init);
        const argument = call?.type === 'CallExpression' ? unwrapExpression(call.arguments[0]) : null;

        if (reporters.length !== 1 || call?.type !== 'CallExpression' || call.optional
            || call.arguments.length !== 1 || !isSharedErrorReporterFactory(call.callee, context)
            || getPath(argument)?.join('.') !== 'events.onError') {
            context.report({
                node: reporters[0] ?? region.opening,
                messageId: 'reporter',
            });
        }
    },
});

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Place Error Handling after Reactive Configuration and create its shared error reporter.',
        includeInReadme: true,
        messages: { ...rule.meta.messages, reporter: 'Declare reportError inside Error Handling using the shared createErrorReporter factory and the callback from config.events.onError, directly or through a destructured alias. Move a flat config.onError callback into config.events. Use const, or let when the callback can change.' },
    },
};
