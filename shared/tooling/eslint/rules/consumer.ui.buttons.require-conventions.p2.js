import { combineUiRules as combineUiChecks } from '#eslint/helpers/combine-ui-rules.js';

// Keep Button structure, props, attributes, comments, spacing, layout, and the
// native-button restriction together as one component rule. Native elements
// require manual replacement to preserve behavior and choose the UI props.
// The label helper hides the static label for icon/icon-* sizes or separate
// dynamic display content, using only class="sr-only". Dynamic spans stay visible.
// Synchronize aria-label and title from the stable static label regardless of
// whether that span is visible, sr-only, or has no class attribute.

import createComponentRules from '#eslint/helpers/create-component-rules.js';
import { combineUiRules } from '#eslint/helpers/combine-ui-rules.js';
import { getComponentLabel } from '#eslint/helpers/get-component-label.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import { getVueAttributeBindings } from '#eslint/helpers/get-vue-attribute-bindings.js';

export const structure = [
    {
        Comment: {
            flags: ['required', 'not-within:TooltipTrigger,DialogClose,DropdownMenuTrigger, AlertDialogAction'],
        },
    },
    {
        Button: {
            flags: ['required', 'label-required', 'label-after-first-icon', 'label-sr-only-when-dynamic', 'comment-source', 'multi-liner', 'single-liner-attributes', 'non-empty', 'no-blank-line-between-children'],
            attributes: {
                type: ['required', 'non-empty'],
                variant: ['required', 'non-empty'],
                size: ['required', 'non-empty'],
            },
        },
    },
];

const uiRuleOrChecks = combineUiRules('Require Button structure, props, attributes, comments, spacing, and layout conventions, and use of the UI Button instead of native buttons.', {
    ...createComponentRules(structure),
    labelAttributes: {
        meta: {
            fixable: 'code',
            messages: {
                syncLabelAttributes: 'Synchronize Button aria-label and title from its static label span, whether visible or sr-only.',
            },
        },
        create(context) {
            // ESLint fixes require a report. Restrict this internal report to the
            // runner's autofix passes; editor linting and final reporting stay silent.
            if (process.env.ESLINT_PASS === undefined) return {};
            const sourceCode = context.sourceCode;
            const services = sourceCode.parserServices;
            if (!services.defineTemplateBodyVisitor) return {};

            return services.defineTemplateBodyVisitor({
                VElement(node) {
                    if (!matchesVueComponentName(node, 'Button')) return;
                    const label = getComponentLabel(sourceCode, node);
                    if (!label?.text) return;
                    const bindings = getVueAttributeBindings(sourceCode, node);
                    if (!bindings || bindings.uncertain) return;
                    const escaped = label.text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
                    const replacements = [];
                    const additions = [];
                    for (const [name, key] of [['aria-label', 'ariaLabel'], ['title', 'title']]) {
                        const existing = bindings.attributes.get(key);
                        if (existing?.value === label.text) continue;
                        if (existing) {
                            // Keep bound/spread values and multiline source intact.
                            if (existing.node.type !== 'VAttribute' || existing.node.directive
                                || existing.node.key.name !== name
                                || /[\r\n\u2028\u2029]/u.test(sourceCode.getText(existing.node))) continue;
                            const duplicates = node.startTag.attributes.filter((attribute) => !attribute.directive && attribute.key.name === name);
                            if (duplicates.length !== 1) continue;
                            replacements.push({node: existing.node, text: `${name}="${escaped}"`});
                        } else {
                            additions.push(`${name}="${escaped}"`);
                        }
                    }
                    if (!replacements.length && !additions.length) return;
                    context.report({
                        node: label.node,
                        messageId: 'syncLabelAttributes',
                        fix(fixer) {
                            const fixes = replacements.map((replacement) => fixer.replaceText(replacement.node, replacement.text));
                            if (additions.length) {
                                // Insert after the tag name, independently of any
                                // existing attribute replacement or layout fix.
                                const end = node.startTag.range[0] + node.rawName.length + 1;
                                fixes.push(fixer.insertTextAfterRange([node.startTag.range[0], end], ` ${additions.join(' ')}`));
                            }
                            return fixes;
                        },
                    });
                },
            });
        },
    },
    nativeButton: {
        meta: {
            messages: {
                nativeButton: 'Replace native <button> with the UI kit\'s <Button>. Preserve its behavior, import Button if needed, and specify type, variant, and size.',
            },
        },
        create(context) {
            const services = context.sourceCode.parserServices;
            if (!services.defineTemplateBodyVisitor) return {};

            return services.defineTemplateBodyVisitor({
                VElement(node) {
                    if (node.rawName !== 'button') return;

                    context.report({
                        loc: node.startTag.loc,
                        messageId: 'nativeButton',
                    });
                },
            });
        },
    },
});

const uiRule = uiRuleOrChecks.meta ? uiRuleOrChecks : combineUiChecks('Follow the buttons UI component structure and usage conventions.', uiRuleOrChecks);

export default {
    ...uiRule,
    meta: {
        ...uiRule.meta,
        description: 'Follow the buttons UI component structure and usage conventions.',
        includeInReadme: true,
    },
};
