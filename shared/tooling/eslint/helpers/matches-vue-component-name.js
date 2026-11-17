export function matchesVueComponentName(node, name) {
    if (node?.type !== 'VElement') return false;

    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    // A native <button> must never satisfy a <Button> requirement.
    return node.rawName === name || (kebab.includes('-') && node.rawName === kebab);
}
