import { basename } from 'node:path';

export default {
    meta: {
        type: 'suggestion',
        description: 'End rule filenames with a numeric priority suffix.',
        includeInReadme: true,
        schema: [],
        messages: { invalid: 'Rename {{filename}} with a final .p<number>.js suffix using a nonnegative safe integer priority.' },
    },
    create(context) {
        return {
            Program(node) {
                const name = basename(context.filename);
                const match = /\.p(\d+)\.js$/u.exec(name);
                if (!match || !Number.isSafeInteger(Number(match[1]))) context.report({ node, messageId: 'invalid', data: { filename: name } });
            },
        };
    },
};
