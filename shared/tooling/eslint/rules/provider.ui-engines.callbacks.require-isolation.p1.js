import ts from 'typescript';
import {trackUiEngineConfigReferences} from '#eslint/helpers/track-ui-engine-config-references.js';
import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Invoke consumer notification callbacks through an isolation helper.',
        includeInReadme: true,
        schema: [],
        messages: {
            isolated: 'Invoke this consumer callback through callConsumer() or an existing isolation helper, rather than calling it directly.',
        },
    },

    create(context) {
        const source = context.sourceCode;
        const services = source.parserServices;
        if (!services.program || !services.esTreeNodeToTSNodeMap) throw new Error('require-isolated-consumer-callbacks requires TypeScript parserOptions.project.');
        const checker = services.program.getTypeChecker();

        function callable(node) {
            const tsNode = services.esTreeNodeToTSNodeMap.get(node);
            if (!tsNode) return false;

            const type = checker.getNonNullableType(checker.getTypeAtLocation(tsNode));

            return type.getCallSignatures().some(function (signature) {
                const result = checker.getReturnTypeOfSignature(signature);

                return Boolean(result.flags & (
                    ts.TypeFlags.Void |
                    ts.TypeFlags.Undefined |
                    ts.TypeFlags.Never
                ));
            });
        }

        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            const config = source.getScope(engine).set.get('config');
            if (!config) return;
            const {getPath, nodes} = trackUiEngineConfigReferences(context, engine);

            function isCallback(expression) {
                expression = unwrap(expression);
                const path = getPath(expression);
                return path?.length > 0 && callable(expression);
            }

            for (const node of nodes) {
                if (node.type !== 'CallExpression') continue;
                const callee = unwrap(node.callee);
                const method = callee.type === 'MemberExpression'
                    ? callee.computed ? callee.property.value : callee.property.name : null;
                if (isCallback(callee) || (['call', 'apply'].includes(method) && isCallback(callee.object))) {
                    context.report({node, messageId: 'isolated'});
                }
            }
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
