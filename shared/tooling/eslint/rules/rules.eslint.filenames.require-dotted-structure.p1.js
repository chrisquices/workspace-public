import { basename } from 'node:path';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use scope.domain.subject.action.p<number>.js for rule filenames.',
        includeInReadme: true,
        schema: [],
        messages: { invalid: 'Rename {{filename}} using scope.domain.subject.action.p<number>.js. Use lowercase kebab-case segments and preserve the rule priority.' },
    },
    create(context) {
        return {
            Program(node) {
                const name = basename(context.filename);
                const parts = name.split('.');
                const valid = parts.length === 6 && parts[5] === 'js' && parts.slice(0, 4).every((part) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(part)) && /^p\d+$/u.test(parts[4]);
                if (!valid) context.report({ node, messageId: 'invalid', data: { filename: name } });
            },
        };
    },
};
