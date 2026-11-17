// Reuse import-aware icon detection, including aliases and namespace imports.
// Only unwrap plain spans or simple v-if/v-else wrappers. Other wrapper behavior,
// structural directives on the icon, comments, and sensitive content stay manual.
import { isImportedLucideIcon } from '#eslint/helpers/is-imported-lucide-icon.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Remove redundant spans around icons while preserving wrapper behavior.',
        includeInReadme: true,
        schema: [],
        fixable: 'code',
        messages: {
            redundant: 'Remove the span around <{{icon}}> and put its simple conditional directive directly on the icon. Preserve adjacent conditional branches and icon attributes.',
            manual: 'Review this span containing only <{{icon}}>. Remove it only after preserving its attributes, directives, comments, and behavior; these prevent automatic unwrapping.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokenStore = services.getTemplateBodyTokenStore();
        const directives = tokenStore.getTokens(template, {includeComments: true}).filter((token) =>
            ['HTMLComment', 'Line', 'Block'].includes(token.type)
            && /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(token.value));
        const structuralDirectives = new Set(['if', 'else-if', 'else', 'for', 'slot', 'pre', 'once', 'memo']);

        return services.defineTemplateBodyVisitor({
            VElement(node) {
                if (node.rawName !== 'span' || !node.endTag) return;
                const children = node.children.filter((child) => child.type !== 'VText' || child.value.trim());
                if (children.length !== 1 || children[0].type !== 'VElement') return;
                const icon = children[0];
                if (!isImportedLucideIcon(icon, sourceCode)) return;

                const attributes = node.startTag.attributes;
                const condition = attributes.length === 1 ? attributes[0] : undefined;
                const transferable = condition?.directive && !condition.key.argument && !condition.key.modifiers.length
                    && ((condition.key.name.name === 'if' && condition.value?.expression)
                        || (condition.key.name.name === 'else' && !condition.value));
                const before = sourceCode.text.slice(node.startTag.range[1], icon.range[0]);
                const after = sourceCode.text.slice(icon.range[1], node.endTag.range[0]);
                let manual = (attributes.length > 0 && !transferable)
                    || !/^[\t \r\n\f]*$/u.test(before + after)
                    || icon.children.some((child) => child.type !== 'VText' || child.value.trim())
                    || icon.startTag.attributes.some((attribute) => attribute.directive && structuralDirectives.has(attribute.key.name.name))
                    || directives.some((comment) => comment.loc.start.line <= node.loc.end.line + 1
                        && comment.loc.end.line + 1 >= node.loc.start.line);

                for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                    if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                        || (ancestor.namespace === 'http://www.w3.org/2000/svg' && ['text', 'tspan', 'textPath'].includes(ancestor.rawName))
                        || ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) {
                        manual = true;
                        break;
                    }
                }

                context.report({
                    node: node.startTag,
                    messageId: manual ? 'manual' : 'redundant',
                    data: {icon: icon.rawName},
                    fix(fixer) {
                        if (manual) return null;
                        const original = sourceCode.getText(icon);
                        const tagEnd = icon.rawName.length + 1;
                        const replacement = condition
                            ? original.slice(0, tagEnd) + ' ' + sourceCode.getText(condition) + original.slice(tagEnd)
                            : original;
                        return fixer.replaceText(node, replacement);
                    },
                });
            },
        });
    },
};
