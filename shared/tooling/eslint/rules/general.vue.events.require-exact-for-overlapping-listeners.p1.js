import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const SYSTEM_MODIFIERS = new Set([
    "ctrl",
    "shift",
    "alt",
    "meta"
]);
const GLOBAL_MODIFIERS = new Set([
    "stop",
    "prevent",
    "capture",
    "self",
    "once",
    "passive",
    "native"
]);
const KEYBOARD_EVENTS = new Set([
    "keydown",
    "keypress",
    "keyup"
]);
function getEventDirectives(startTag, sourceCode) {
    return utils.getDirectives(startTag, "on").map((attribute) => ({
        name: attribute.key.argument ? sourceCode.getText(attribute.key.argument) : "",
        node: attribute.key,
        modifiers: attribute.key.modifiers.map((modifier) => modifier.name),
        hasHandler: Boolean(attribute.value)
    }));
}
function isKeyModifier(modifier) {
    return !GLOBAL_MODIFIERS.has(modifier) && !SYSTEM_MODIFIERS.has(modifier);
}
function isSystemModifier(modifier) {
    return SYSTEM_MODIFIERS.has(modifier);
}
function hasSystemModifier(modifiers) {
    return modifiers.some(isSystemModifier);
}
function isGlobalOnlyKeyboardStopEvent(event) {
    return KEYBOARD_EVENTS.has(event.name) && event.modifiers.includes("stop") && !event.hasHandler && event.modifiers.every((modifier) => GLOBAL_MODIFIERS.has(modifier));
}
function groupEvents(events) {
    const grouped = {};
    for (const event of events) {
        if (!grouped[event.name]) grouped[event.name] = [];
        grouped[event.name].push(event);
    }
    return grouped;
}
function getSystemModifiersString(modifiers) {
    return modifiers.filter(isSystemModifier).sort((a, b) => a.localeCompare(b)).join(",");
}
function getKeyModifiersString(modifiers) {
    return modifiers.filter(isKeyModifier).sort((a, b) => a.localeCompare(b)).join(",");
}
function hasConflictedModifiers(baseEvent, event) {
    if (event.node === baseEvent.node || event.modifiers.includes("exact") || baseEvent.modifiers.includes("exact") && isGlobalOnlyKeyboardStopEvent(event)) return false;
    const eventKeyModifiers = getKeyModifiersString(event.modifiers);
    const baseEventKeyModifiers = getKeyModifiersString(baseEvent.modifiers);
    if (eventKeyModifiers && baseEventKeyModifiers && eventKeyModifiers !== baseEventKeyModifiers) return false;
    const eventSystemModifiers = getSystemModifiersString(event.modifiers);
    const baseEventSystemModifiers = getSystemModifiersString(baseEvent.modifiers);
    return baseEvent.modifiers.length > 0 && baseEventSystemModifiers !== eventSystemModifiers && baseEventSystemModifiers.includes(eventSystemModifiers);
}
function findConflictedEvents(events) {
    const conflictedEvents = [];
    for (const event of events) conflictedEvents.push(...events.filter((evt) => !conflictedEvents.includes(evt)).filter(hasConflictedModifiers.bind(null, event)));
    return conflictedEvents;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Review overlapping event listeners and use exact modifiers when they should be exclusive.',
        includeInReadme: true,
        schema: [],
        messages: {
            "considerExact": "Consider to use '.exact' modifier." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const sourceCode = context.sourceCode;
        return utils.defineTemplateBodyVisitor(context, { VStartTag(node) {
            if (node.attributes.length === 0) return;
            const isCustomComponent = utils.isCustomComponent(node.parent);
            let events = getEventDirectives(node, sourceCode);
            if (isCustomComponent) events = events.filter((event) => event.modifiers.includes("native"));
            const grouppedEvents = groupEvents(events);
            for (const eventsInGroup of Object.values(grouppedEvents)) {
                if (!eventsInGroup.some((event) => hasSystemModifier(event.modifiers))) continue;
                const conflictedEvents = findConflictedEvents(eventsInGroup);
                for (const e of conflictedEvents) context.report({
                    node: e.node,
                    loc: e.node.loc,
                    messageId: "considerExact"
                });
            }
        } });
    },
};
