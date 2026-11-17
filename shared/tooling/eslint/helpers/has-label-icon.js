import { nonIconExports } from '#eslint/helpers/is-imported-lucide-icon.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';


export function hasLabelIcon(label, icons) {
    const pending = [...label.children];
    for (const node of pending) {
        if (node.type !== 'VElement' || matchesVueComponentName(node, label.rawName)) {
            continue;
        }

        if ([...icons.names].some((function (name) { return (matchesVueComponentName(node, name)); }))) {
            return true;
        }

        const [namespace, member, extra] = node.rawName.split('.');

        if (icons.namespaces.has(namespace) && member && !extra
            && !nonIconExports.has(member)) return true;

        // Dynamic bindings are accepted syntactically; their runtime component cannot be proven here.
        if (node.rawName === 'component' && node.startTag.attributes.some((function (attribute) { return (attribute.directive
            && attribute.key.name.name === 'bind' && attribute.key.argument?.type === 'VIdentifier'
            && attribute.key.argument.name === 'is' && attribute.value?.expression); }))) return true;

        pending.push(...node.children);
    }

    return false;
}
