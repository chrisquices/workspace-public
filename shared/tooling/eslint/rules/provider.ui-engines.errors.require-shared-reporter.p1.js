import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';
import {trackUiEngineConfigReferences} from '#eslint/helpers/track-ui-engine-config-references.js';
import { isSharedErrorReporterFactory } from '#eslint/helpers/is-shared-error-reporter-factory.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use the shared error reporter with the callback under config.events.onError.',
        includeInReadme: true,
        schema: [],
        messages: {
            flat: 'Declare the error callback under config.events.onError, not config.onError.',
            reporter: 'Create the error reporter using createErrorReporter from workspace-packages/ui-engines/shared/core. Pass config.events.onError directly or through a destructured alias.',
        },
    },

    create(context) {
        const source = context.sourceCode;

        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            const config = source.getScope(engine).set.get('config');
            if (!config) return;
            const declarations = engine.body.body.filter(statement => statement.type === 'VariableDeclaration')
                .flatMap(statement => statement.declarations);
            const {getPath, nodes, paths} = trackUiEngineConfigReferences(context, engine);
            const configPaths = [...paths.values(), ...nodes.map(getPath)];
            let hasFlatOnError = configPaths.some(path => path?.join('.') === 'onError');
            let hasOnError = configPaths.some(path => path?.join('.') === 'events.onError');
            const services = source.parserServices;
            if (services.program && services.esTreeNodeToTSNodeMap) {
                const declaration = declarations.find(entry => entry.id.type === 'ObjectPattern' && getPath(entry.init)?.length === 0);
                if (declaration) {
                    const checker = services.program.getTypeChecker();
                    const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(declaration.init));
                    const events = checker.getPropertyOfType(type, 'events');
                    const eventType = events && checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(events, services.esTreeNodeToTSNodeMap.get(declaration.init)));
                    hasFlatOnError ||= Boolean(checker.getPropertyOfType(type, 'onError'));
                    hasOnError ||= Boolean(eventType && checker.getPropertyOfType(eventType, 'onError'));
                }
            }
            if (hasFlatOnError) {
                context.report({node: engine, messageId: 'flat'});
                return;
            }
            if (!hasOnError) return;
            const found = declarations.some(declaration => {
                const call = unwrapExpression(declaration.init);
                if (declaration.id.type !== 'Identifier' || call?.type !== 'CallExpression' || call.optional
                    || call.arguments.length !== 1 || !isSharedErrorReporterFactory(call.callee, context)) return false;
                return getPath(call.arguments[0])?.join('.') === 'events.onError';
            });
            if (!found) context.report({node: engine, messageId: 'reporter'});
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
