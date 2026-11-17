// Format existing top-level script attributes without adding setup/lang or
// converting their values. Presence and language requirements have their own
// rules. Preserve raw entities when changing quotes; multiline values stay manual.

import { getVueBlocks } from '#eslint/helpers/get-vue-blocks.js';

const lineBreak = /[\r\n\u2028\u2029]/u;

export default {
    meta: {
        type: 'layout',
        description: 'Write script opening tags on one line with setup first, lang second, and double-quoted values.',
        includeInReadme: false,
        fixable: 'code',
        schema: [],
        messages: {
            format: 'Write this script opening tag as {{expected}}. Preserve its attributes, values, and script contents.',
            manual: 'Format this script opening tag on one line with setup first, lang next, double-quoted values, and no spaces around =. Preserve multiline values and directive behavior; resolve malformed or duplicate attributes before applying the layout.',
        },
    },

    create(context) {
        const vue = getVueBlocks(context);

        if (!vue) return {};

        return {
            Program() {
                const sourceCode = context.sourceCode;

                for (const block of vue.blocks) {
                    if (block.rawName !== 'script') continue;

                    const attributes = block.startTag.attributes;
                    const names = attributes.map((attribute) => sourceCode.getText(attribute.key));
                    let safe = vue.canFixStructure && new Set(names).size === names.length;
                    let multilineValue = false;
                    const formatted = attributes.map((attribute, index) => {
                        const name = names[index];
                        if (attribute.directive || lineBreak.test(name)) safe = false;
                        const rank = !attribute.directive && name === 'setup' ? 0
                            : !attribute.directive && name === 'lang' ? 1 : 2;

                        if (!attribute.value) return { rank: rank, text: name };

                        const raw = sourceCode.getText(attribute.value);
                        const quoted = ['"', "'"].includes(raw[0]);
                        if (quoted && raw.at(-1) !== raw[0]) safe = false;
                        const value = quoted ? raw.slice(1, -1) : raw;
                        if (lineBreak.test(value)) {
                            multilineValue = true;
                            safe = false;
                        }

                        return { rank: rank, text: `${name}="${value.replaceAll('"', '&quot;')}"` };
                    }).sort((left, right) => left.rank - right.rank);
                    const ending = block.startTag.selfClosing ? ' />' : '>';
                    const expected = `<script${formatted.length ? ' ' + formatted.map((attribute) => attribute.text).join(' ') : ''}${ending}`;

                    if (sourceCode.getText(block.startTag) === expected && !multilineValue) continue;

                    context.report({
                        loc: block.startTag.loc,
                        messageId: safe ? 'format' : 'manual',
                        data: { expected: expected },
                        fix(fixer) {
                            return safe ? fixer.replaceText(block.startTag, expected) : null;
                        },
                    });
                }
            },
        };
    },
};
