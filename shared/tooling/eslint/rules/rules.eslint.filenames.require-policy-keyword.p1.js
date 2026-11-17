import { basename } from 'node:path';

export default {
    meta: {
        type: 'suggestion',
        description: 'Start the rule filename action with ban- or require-.',
        includeInReadme: true,
        schema: [],
        messages: { invalid: 'Rename {{filename}} so the action starts with ban- or require- followed by the behavior.' },
    },
    create(context) {
        return {
            Program(node) {
                const name = basename(context.filename);
                const parts = name.split('.');
                if (parts.length !== 6 || !/^(?:ban|require)-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(parts[3])) context.report({ node, messageId: 'invalid', data: { filename: name } });
            },
        };
    },
};
