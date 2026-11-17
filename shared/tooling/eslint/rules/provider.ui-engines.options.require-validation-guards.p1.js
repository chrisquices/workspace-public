import {createUiEngineValidationGuardsRule} from '#eslint/helpers/create-ui-engine-validation-guards-rule.js';

const rule = createUiEngineValidationGuardsRule('options', 'validateOptions', true);

export default {
    ...rule,
    meta: {
        ...rule.meta,
        description: 'Validate each options field in its own throwing guard before cross-field checks.',
        includeInReadme: true,
    },
};
