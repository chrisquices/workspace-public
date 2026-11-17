// A UI component is one rule. Its generated checks and custom checks share one
// message catalog and run through the same ESLint context and template parser.
// Reuse identical messages across checks and require unique IDs for other text.
export function combineUiRules(description, checks) {
    const rules = Object.values(checks);
    const messages = {};

    for (const rule of rules) {
        for (const [id, message] of Object.entries(rule.meta.messages)) {
            if (Object.hasOwn(messages, id) && messages[id] !== message) {
                throw new TypeError(`UI checks define conflicting message text for ${id}. Use a unique message ID.`);
            }

            messages[id] = message;
        }
    }

    return {
        meta: {
            type: 'problem',
            docs: { description: description },
            schema: [],
            messages: messages,
            hasSuggestions: rules.some(function (rule) { return rule.meta.hasSuggestions; }),
            ...(rules.some(function (rule) { return rule.meta.fixable; }) ? { fixable: 'code' } : {}),
        },

        create(context) {
            const listeners = new Map();

            for (const rule of rules) {
                for (const [event, listener] of Object.entries(rule.create(context))) {
                    if (!listeners.has(event)) {
                        listeners.set(event, []);
                    }

                    listeners.get(event).push(listener);
                }
            }

            return Object.fromEntries([...listeners].map(function ([event, handlers]) {
                return [event, function (...args) {
                    for (const handler of handlers) {
                        handler.apply(this, args);
                    }
                }];
            }));
        },
    };
}
