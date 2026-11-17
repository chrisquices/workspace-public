export function* walkComponentStructure(instance, includeExternal = false) {
    // The call site satisfies presence/order, but its implementation's flags
    // must never edit the call site's attributes, slots, or source ranges.
    if (instance.external && !includeExternal) return;
    yield instance;
    for (const child of instance.children) yield* walkComponentStructure(child, includeExternal);
}
