// Opt in through label-required on any component definition. Its first direct
// span is the stable, nonempty, plain-text label and the comment-source text.
// label-after-first-icon places it after the first imported icon and its
// conditional branches, or first without an icon. Never split a v-if/v-else
// chain with the label. label-sr-only-when-dynamic hides that stable label when
// other content contains interpolation or text-changing directives, or a Button
// uses an icon size. Hidden static labels have only class="sr-only"; dynamic
// spans never have sr-only. Unknown size/class bindings remain manual. Dynamic
// content belongs in separate direct-child spans. Ordinary attribute bindings
// such as :disabled do not make label content dynamic.
// A missing label can be autofixed when there is one plain-text child and the
// remaining content is whitespace, textless imported icons, or named slots.
// Named slot templates are separate content: never wrap, move, or infer label
// visibility from their contents. Default and unknown dynamic slots stay manual.
// Additional bare static text must also be wrapped once a valid label exists.
// Preserve raw
// text, entities, and surrounding whitespace. Mixed content stays manual.

import {normalizeClass} from '@vue/shared';
import { getVueAttributeBindings } from '#eslint/helpers/get-vue-attribute-bindings.js';
import { isImportedLucideIcon } from '#eslint/helpers/is-imported-lucide-icon.js';
import { getComponentLabel } from '#eslint/helpers/get-component-label.js';
import { getComponentLabelContent } from '#eslint/helpers/get-component-label-content.js';

function isNamedSlot(node) {
    if (node.type !== 'VElement' || node.rawName !== 'template') return false;
    const slots = node.startTag.attributes.filter((attribute) => attribute.directive && attribute.key.name.name === 'slot');
    return slots.length === 1 && slots[0].key.argument?.type === 'VIdentifier'
        && slots[0].key.argument.name !== 'default';
}

function wrapStaticText(fixer, sourceCode, text) {
    const original = sourceCode.getText(text);
    const leading = original.match(/^[\t \r\n\f]*/u)[0].length;
    const trailing = original.match(/[\t \r\n\f]*$/u)[0].length;
    const content = original.slice(leading, original.length - trailing);
    return fixer.replaceTextRange(
        [text.range[0] + leading, text.range[1] - trailing],
        `<span>${content}</span>`,
    );
}

function hasDynamicContent(sourceCode, node) {
    if (node.type === 'VExpressionContainer') return true;
    if (node.type !== 'VElement' || isImportedLucideIcon(node, sourceCode)) return false;
    return node.startTag.attributes.some((attribute) => attribute.directive
        && (['text', 'html'].includes(attribute.key.name.name)
            || (attribute.key.name.name === 'bind' && attribute.key.argument?.type === 'VIdentifier'
                && ['innerhtml', 'textcontent'].includes(attribute.key.argument.name.replaceAll('-', '').toLowerCase()))
            || (['if', 'else-if', 'else', 'for', 'show'].includes(attribute.key.name.name)
                && node.children.some((child) => child.type !== 'VText' || child.value.trim()))))
        || node.children.some((child) => hasDynamicContent(sourceCode, child));
}

function hasUnknownClass(value) {
    if (typeof value === 'symbol') return true;
    if (Array.isArray(value)) return value.some(hasUnknownClass);
    return value !== null && typeof value === 'object' && Object.values(value).some(hasUnknownClass);
}

export const labelMessages = {
    labelRequired: 'Add a direct-child <span> containing a nonempty static label to <{{element}}>. Its first direct-child span supplies the stable label and comment text. A single plain-text label can be wrapped automatically. Resolve mixed or dynamic content manually and keep dynamic display content in a separate span.',
    labelRequiredAsChild: 'Add a direct-child <span> containing a nonempty static label inside the as-child element of <{{element}}>. Keep dynamic display content in a separate span.',
    labelPosition: 'Place the static label span {{placement}} inside <{{element}}>. Preserve its text, bindings, and surrounding comments.',
    labelDynamicSpan: 'Wrap this dynamic display content in a separate direct-child <span> inside <{{element}}>. Keep the first span static so comment inference has a stable label.',
    labelTextSpan: 'Wrap this plain text in a direct-child <span> inside <{{element}}>. Preserve its text and surrounding whitespace; keep named slot templates separate.',
    labelVisibility: '{{instruction}} in <{{element}}>. Hidden static labels must have only class="sr-only"; visible spans must not have sr-only. Preserve text and resolve uncertain size or class bindings manually.',
};

function checkLabelVisibility(context, owner, span, hidden) {
    const sourceCode = context.sourceCode;
    const bindings = getVueAttributeBindings(sourceCode, span);
    if (!bindings) return;
    const classBinding = bindings.attributes.get('class');
    const classAttributes = span.startTag.attributes.filter((attribute) => !attribute.directive
        ? attribute.key.name === 'class'
        : attribute.key.name.name === 'bind'
            && (attribute.key.argument?.type !== 'VIdentifier' || attribute.key.argument.name === 'class'));
    const staticAttributes = classAttributes.filter((attribute) => !attribute.directive);
    const staticClasses = staticAttributes
        .flatMap((attribute) => (attribute.value?.value ?? '').split(/\s+/u)).filter(Boolean);
    const known = !bindings.uncertain && !hasUnknownClass(classBinding?.value)
        && classAttributes.every((attribute) => !attribute.directive || attribute === classBinding?.node);
    const classes = [...staticClasses, ...(known ? normalizeClass(classBinding?.value).split(/\s+/u).filter(Boolean) : [])];
    const staticOnly = known && classAttributes.length === staticAttributes.length && staticAttributes.length <= 1
        && (!classBinding || staticAttributes.includes(classBinding.node));
    if (hidden === true && staticOnly && staticAttributes[0]?.value?.value === 'sr-only') return;
    if (hidden === false && known && !classes.includes('sr-only')) return;

    context.report({
        loc: span.startTag.loc,
        messageId: 'labelVisibility',
        data: {
            element: owner.rawName,
            instruction: hidden === null ? 'Resolve whether the static label must be hidden for this dynamic Button size'
                : hidden ? 'Set exactly class="sr-only" on the static label span'
                    : 'Remove sr-only from this visible span, preserving its other classes',
        },
        fix(fixer) {
            // Never flatten bindings or overwrite classes supplied by a spread.
            if (hidden === null || !staticOnly) return null;
            const attribute = staticAttributes[0];
            if (attribute && /[\r\n\u2028\u2029]/u.test(sourceCode.getText(attribute))) return null;
            const updated = hidden ? 'sr-only' : staticClasses.filter((name) => name !== 'sr-only').join(' ');
            const escaped = updated.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
            if (attribute) return updated ? fixer.replaceText(attribute, `class="${escaped}"`) : fixer.remove(attribute);
            return fixer.insertTextAfterRange([span.startTag.range[0], span.startTag.range[0] + '<span'.length], ' class="sr-only"');
        },
    });
}

export function checkComponentLabel(context, instance) {
    const {entry, node} = instance;
    if (!entry.labelRequired) return;
    const sourceCode = context.sourceCode;
    const label = getComponentLabel(sourceCode, node);
    const content = getComponentLabelContent(node);
    const children = content.children.filter((child) => !isNamedSlot(child) && (child.type !== 'VText' || child.value.trim()));
    const dynamic = children.filter((child) => hasDynamicContent(sourceCode, child));
    if (entry.labelSrOnlyWhenDynamic) {
        for (const child of dynamic) {
            if (child.type === 'VElement' && child.rawName === 'span') checkLabelVisibility(context, node, child, false);
        }
    }
    if (!label?.text) {
        context.report({
            loc: label?.node?.startTag.loc ?? node.startTag.loc,
            messageId: content === node ? 'labelRequired' : 'labelRequiredAsChild',
            data: {element: node.rawName},
            fix(fixer) {
                if (label?.node) return null;
                const bindings = getVueAttributeBindings(sourceCode, node);
                if (!bindings || bindings.uncertain || node.startTag.attributes.some((attribute) => attribute.directive
                    && ['text', 'html', 'slot'].includes(attribute.key.name.name))
                    || [...bindings.attributes.keys()].some((name) => ['innerhtml', 'textcontent'].includes(name.toLowerCase()))) return null;

                const text = content.children.filter((child) => child.type === 'VText' && child.value.trim());
                if (text.length !== 1) return null;
                for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                        || ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return null;
                }
                for (const child of children.filter((child) => child.type !== 'VText')) {
                    if (child.type !== 'VElement' || !isImportedLucideIcon(child, sourceCode)
                        || !child.children.every((content) => content.type === 'VText' && !content.value.trim())) return null;
                    const iconBindings = getVueAttributeBindings(sourceCode, child);
                    if (!iconBindings || iconBindings.uncertain || child.startTag.attributes.some((attribute) => attribute.directive
                        && ['text', 'html'].includes(attribute.key.name.name))
                        || [...iconBindings.attributes.keys()].some((name) => ['innerhtml', 'textcontent'].includes(name.toLowerCase()))) return null;
                }

                return wrapStaticText(fixer, sourceCode, text[0]);
            },
        });
        return;
    }

    for (const child of children.filter((child) => child.type === 'VText')) {
        context.report({
            loc: child.loc,
            messageId: 'labelTextSpan',
            data: {element: node.rawName},
            fix(fixer) {
                for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                        || ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return null;
                }
                return wrapStaticText(fixer, sourceCode, child);
            },
        });
    }

    for (const child of dynamic) {
        if (child.type === 'VElement' && child.rawName === 'span') continue;
        context.report({
            loc: child.loc,
            messageId: 'labelDynamicSpan',
            data: {element: node.rawName},
            fix(fixer) {
                // Wrapping a bare interpolation is unambiguous. Components and
                // conditional branches need review of their layout and scope.
                if (child.type !== 'VExpressionContainer' || !child.expression) return null;
                for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                        || ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return null;
                }
                return fixer.replaceText(child, `<span>${sourceCode.getText(child)}</span>`);
            },
        });
    }

    if (entry.labelAfterFirstIcon) {
        const icon = children.find((child) => child.type === 'VElement' && isImportedLucideIcon(child, sourceCode));
        const leadingSlot = content.children.filter((child) => isNamedSlot(child)
            && child.range[1] <= children[0]?.range[0]).at(-1);
        let anchor = icon ?? leadingSlot ?? content.startTag;
        if (icon?.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'if')) {
            // Ignore the label itself so an already-split chain can be repaired.
            // Other meaningful content still terminates the adjacent icon chain.
            const siblings = children.filter((child) => child !== label.node);
            for (let index = siblings.indexOf(icon) + 1; index < siblings.length; index++) {
                const branch = siblings[index];
                if (branch.type !== 'VElement' || !isImportedLucideIcon(branch, sourceCode)) break;
                const directive = branch.startTag.attributes.find((attribute) => attribute.directive
                    && ['if', 'else-if', 'else'].includes(attribute.key.name.name))?.key.name.name;
                if (!['else-if', 'else'].includes(directive)) break;
                anchor = branch;
                if (directive === 'else') break;
            }
        }
        const expected = icon ? children.indexOf(anchor) + 1 : 0;
        if (children.indexOf(label.node) !== expected) {
            context.report({
                loc: label.node.loc,
                messageId: 'labelPosition',
                data: {element: node.rawName, placement: icon
                    ? anchor === icon ? 'immediately after the first icon' : 'immediately after the first icon’s conditional chain'
                    : 'before all other content'},
                fix(fixer) {
                    if (label.node.startTag.attributes.some((attribute) => attribute.directive)) return null;
                    for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                        if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)) return null;
                    }
                    const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore();
                    const start = Math.min(anchor.range[1], label.node.range[0]);
                    const end = Math.max(anchor.range[1], label.node.range[1]);
                    if (tokenStore.getTokens(node, {includeComments: true}).some((token) => (
                        token.type === 'HTMLComment' && token.range[0] >= start && token.range[1] <= end
                    ))) return null;
                    const newline = sourceCode.text.includes('\r\n') ? '\r\n' : '\n';
                    const indent = sourceCode.lines[label.node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                    return [fixer.remove(label.node), fixer.insertTextAfter(anchor, `${newline}${indent}${sourceCode.getText(label.node)}`)];
                },
            });
        }
    }

    if (!entry.labelSrOnlyWhenDynamic) return;
    let hidden = dynamic.length > 0;
    if (!hidden && entry.name === 'Button') {
        const bindings = getVueAttributeBindings(sourceCode, node);
        if (!bindings) return;
        const size = bindings.attributes.get('size')?.value;
        hidden = bindings.uncertain || typeof size === 'symbol' ? null
            : typeof size === 'string' && (size === 'icon' || size.startsWith('icon-'));
    }
    checkLabelVisibility(context, node, label.node, hidden);
}
