// This list is both the approved vocabulary and the order for Vue template
// opening tags, including native elements and components. Each ordinary name
// approves its static and shorthand-bound forms, with static first: class, :class.
// These stay separate attributes within one list position. Other directives,
// longhand bindings, modifiers, and casing require their exact authored keys.
// Only the developer authorizes additions and positions. Agents must stop and
// ask on unknown keys; never expand this list or suppress a report themselves.
// Missing attributes are skipped, never inserted. Unknown keys prevent reordering.
// Runtime keys/spread contents are not inferred from an approved directive key.

import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const attributeOrder = [
    // Vue structure
    'v-for',
    'v-if',
    'v-else-if',
    'v-else',
    'v-show',
    'v-once',
    'v-memo',
    'ref',
    null,
    'key',

    // Element identity
    'as',
    'as-child',
    'is',
    'element',
    'to',
    'id',
    'type',
    'name',
    'for',
    'form',
    'xmlns',

    // Navigation and media
    'href',
    'preserve-state',
    'breadcrumbs',
    'src',
    'source',
    'player-id',
    'alt',
    'view-transition',
    'prefetch',
    'cache-tags',
    'autoplay',
    'decoding',

    // Appearance
    'variant',
    'size',
    'item-size',
    'width',
    'height',
    'view-box',
    'viewBox',
    'preserveAspectRatio',
    'x',
    'y',
    'rx',
    'opacity',
    'fit',
    'ratio',
    'gap',
    'spacing',
    'rows',
    'colspan',
    'side',
    'align',
    'orientation',
    'view-mode',
    'columns',
    'class',
    'content-class',
    'icon-class',
    'style',

    // Transitions
    'mode',
    'enter-active-class',
    'enter-from-class',
    'enter-to-class',
    'leave-active-class',
    'leave-from-class',
    'leave-to-class',

    // Value
    'v-model',
    'v-model:checked',
    'v-model:date-range',
    'v-model:user-id',
    'v-model:open',
    'v-model:expanded-ids',
    'v-model:selected-node-id',
    'v-model:view-mode',
    'v-model:grid-size',
    'v-model:table-size',
    'model-value',
    'default-value',
    'value',
    'data',
    'generation',
    'generations',
    'usages',
    'users',
    'credit-spend',
    'provider-cost',
    'profit',
    'items',
    'item-key',
    'item-count',
    'visible-previews',
    'show-item-count',
    'nodes',
    'folders',
    'default-expanded-ids',
    'selected-id',
    'selected-uuid',
    'selected-node-id',
    'space-uid',
    'selected-folder',
    'selected-count',
    'focused-uid',
    'animated-uid',
    'file',
    'files',
    'metadata',
    'label',
    'heading',
    'description',
    'placeholder',
    'v-text',
    'v-html',

    // Behavior and state
    'state',
    'status',
    'virtualizer',
    'force-mount',
    'thumb-attrs',
    'initial-focus',
    'collapsible',
    'open',
    'dismissible',
    'show-close-button',
    'interactive',
    'activation-mode',
    'selected',
    'is-active',
    'highlighted',
    'sortable',
    'sorted',
    'sort-by',
    'sort-direction',
    'truncate',
    'optimize',
    'start-at-edge',
    'required',
    'min',
    'minlength',
    'max',
    'maxlength',
    'step',
    'accept',
    'multiple',
    'webkitdirectory',
    'draggable',
    'autofocus',
    'autocomplete',
    'inputmode',
    'passwordrules',
    'hidden',
    'inert',
    'loading',
    'processing',
    'processing-delete',
    'processing-retry',
    'error',
    'on-error',
    'errors',
    'disabled',
    'upload-blocked',
    'upload-disabled',
    'readonly',

    // Metadata
    'data-test',
    'data-slot',
    'data-variant',
    'data-size',
    'data-loading',
    'data-state',
    'data-invalid',
    'data-library-index',
    'data-library-item',
    'data-library-file',
    'data-library-folder',
    'data-library-folder-tree',
    'data-space-index',
    'data-space-item',
    'data-space-file',
    'data-space-folder',
    'data-space-folder-tree',
    'data-space-collection',
    'data-demo-padding',

    // Accessibility and descriptions
    'role',
    'tabindex',
    'title',

    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-description',
    'aria-controls',
    'aria-expanded',
    'aria-haspopup',
    'aria-pressed',
    'aria-invalid',
    'aria-current',
    'aria-disabled',
    'aria-busy',
    'aria-hidden',
    'aria-keyshortcuts',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',

    // Events
    '@click',
    '@click.passive',
    '@click.capture',
    '@click.exact',
    '@click.self.exact',
    '@click.stop',
    '@click.prevent',
    '@click.stop.prevent',
    '@click.stop.exact',
    '@click.prevent.exact',
    '@click.ctrl.exact',
    '@click.shift.exact',
    '@click.shift.exact.stop',
    '@click.alt.exact',
    '@click.meta.exact',
    '@click.meta.exact.stop',

    '@dblclick',
    '@dblclick.stop',
    '@contextmenu',
    '@contextmenu.capture',
    '@contextmenu.stop',
    '@activate',
    '@open',
    '@close',
    '@preview',
    '@toggle',
    '@toggle-all',
    '@select',
    '@select.prevent',
    '@select-all',
    '@clear',
    '@sort',
    '@change',
    '@update:model-value',
    '@update:open',
    '@update:state',
    '@submit',
    '@submit.prevent',
    '@new-folder',
    '@upload',
    '@upload-files',
    '@upload-folder',
    '@files-added',
    '@cancel',
    '@retry',
    '@load',
    '@error',
    '@animation-error',
    '@before-enter',
    '@after-enter',
    '@after-leave',
    '@open-auto-focus',
    '@close-auto-focus',
    '@close-auto-focus.prevent',
    '@focus',
    '@blur',
    '@focusin',
    '@focusout',
    '@hover',
    '@hover-end',
    '@keydown',
    '@keydown.enter',
    '@keydown.enter.prevent',
    '@keydown.enter.self',
    '@keydown.esc.prevent',
    '@keydown.space',
    '@keydown.space.prevent',
    '@keydown.space.self.prevent.stop',
    '@keyup',

    '@pointerdown',
    '@pointerdown.self',
    '@pointerdown.shift.exact',
    '@pointerdown.capture',
    '@pointerup',
    '@pointerenter',
    '@pointerleave',
    '@pointerover',
    '@pointerout',
    '@pointercancel',
    '@dragstart.prevent',
    '@mousedown',
    '@mouseup',
    '@mouseenter',
    '@mouseleave',
    '@touchstart',
    '@touchend',
    '@touchcancel',
    'item',
    'selected-uids',
    'is-trash',
    '@rename',
    '@download',
    '@download-zip',
    '@delete',
    '@delete-file',
    '@delete-files',
    '@restore',
    '@purge',
    '@purge-file',
    '@purge-files',
];

const ranks = new Map(attributeOrder.map((name, index) => [name, index]));

function attributeRank(attribute, name) {
    if (attribute.directive && attribute.key.name.name === 'slot'
        && attribute.key.argument?.type === 'VIdentifier' && !attribute.key.modifiers.length) {
        return ranks.get(null) * 2;
    }

    const direct = ranks.get(name);
    if (direct !== undefined) return direct * 2;

    if (!attribute.directive || attribute.key.name.name !== 'bind'
        || attribute.key.modifiers.length || attribute.key.argument?.type !== 'VIdentifier'
        || !name.startsWith(':')) return undefined;

    const base = name.slice(1);
    if (!/^[A-Za-z_][\w.:-]*$/u.test(base) || base.startsWith('v-')) return undefined;
    const rank = ranks.get(base);
    return rank === undefined ? undefined : rank * 2 + 1;
}

// Only attributes whose relative order reverses need a safety decision.
// Binding expressions, including calls, are reorderable by project convention:
// rendering must not depend on attribute evaluation order. Retain protections
// for competing runtime keys, spreads, dynamic names, and unknown directives.
const runtimeKey = (name) => name.replaceAll('-', '').toLowerCase();

function attributeEffects(attribute) {
    if (!attribute.directive) return { keys: [runtimeKey(attribute.key.name)] };

    const directive = attribute.key.name.name;
    if (['if', 'else-if', 'else', 'for', 'once', 'memo', 'slot'].includes(directive)) {
        return { keys: [`directive:${directive}`] };
    }

    const argument = attribute.key.argument;
    if (argument && argument.type !== 'VIdentifier') {
        return { reason: 'its dynamic argument can target an unknown runtime key' };
    }
    const name = argument?.name;

    if (directive === 'bind') {
        if (!name) return { reason: 'its spread binding can override unknown runtime keys' };
        if (attribute.key.modifiers.some((modifier) => !['camel', 'prop', 'attr'].includes(modifier.name))) {
            return { reason: 'its binding modifier has unrecognized runtime behavior' };
        }
        return { keys: [runtimeKey(name)] };
    }
    if (directive === 'on') {
        if (!name) return { reason: 'its listener map can contain competing event handlers' };
        // All variants of an event compete, including different modifiers.
        return { keys: [runtimeKey(`on${name}`)] };
    }
    if (directive === 'model') {
        const prop = name ?? 'modelValue';
        return {
            keys: [prop, `onUpdate:${prop}`, name ? `${name}Modifiers` : 'modelModifiers', 'value', 'checked'].map(runtimeKey),
        };
    }
    if (directive === 'text' || directive === 'html') {
        return { keys: ['textcontent', 'innerhtml'] };
    }
    return { reason: 'its directive has unrecognized runtime ordering behavior' };
}

function crossingReason(left, right, leftName, rightName) {
    if (left.reason) return `Cannot move "${leftName}" across "${rightName}" because ${left.reason}.`;
    if (right.reason) return `Cannot move "${rightName}" across "${leftName}" because ${right.reason}.`;
    if (left.keys.some((key) => right.keys.includes(key))) {
        return `Swapping "${leftName}" and "${rightName}" would reverse competing attribute values or same-event handlers.`;
    }
    return '';
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Order Vue template attributes using the approved list; ask the developer about unknown attributes.',
        includeInReadme: true,
        schema: [],
        fixable: 'code',
        messages: {
            unknown: 'Unapproved attribute "{{attribute}}" on <{{element}}>. It has no entry in consumer.vue.attributes.require-approved-order.p2.js. Agents: stop and ask the developer how to proceed and where it belongs in the order. Do not add support, rename, remove, or suppress this attribute without explicit developer approval.',
            order: 'Order the existing attributes on <{{element}}> as: {{order}}. Move "{{expected}}" before "{{actual}}". Autofix moves whole attributes while preserving their values and bindings; rendering expressions must not depend on attribute evaluation order.',
            manual: 'Order the existing attributes on <{{element}}> as: {{order}}. Move "{{expected}}" before "{{actual}}". Autofix blocked: {{reason}} Correct manually while preserving binding precedence, listener order, comments, and behavior.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;
        const template = sourceCode.ast.templateBody;
        if (!template || !services.defineTemplateBodyVisitor || !services.getTemplateBodyTokenStore) return {};

        const tokenStore = services.getTemplateBodyTokenStore();
        const directives = tokenStore.getTokens(template, { includeComments: true }).filter(isLineDirective);

        return services.defineTemplateBodyVisitor({
            VStartTag(node) {
                const attributes = node.attributes;
                const names = attributes.map((attribute) => sourceCode.getText(attribute.key));
                const ranked = attributes.map((attribute, index) => ({ attribute, name: names[index], rank: attributeRank(attribute, names[index]) }));
                let unknown = false;
                for (const [index, name] of names.entries()) {
                    if (ranked[index].rank !== undefined) continue;
                    unknown = true;
                    context.report({
                        node: attributes[index].key,
                        messageId: 'unknown',
                        data: { attribute: name, element: node.parent.rawName },
                    });
                }
                if (unknown) return;

                const sorted = [...ranked].sort((left, right) => left.rank - right.rank);
                const firstMismatch = attributes.findIndex((attribute, index) => attribute !== sorted[index].attribute);
                if (firstMismatch === -1) return;

                const effects = attributes.map(attributeEffects);
                const positions = new Map(sorted.map((entry, index) => [entry.attribute, index]));
                let reason = '';

                for (let index = 0; index < attributes.length && !reason; index++) {
                    for (let next = index + 1; next < attributes.length && !reason; next++) {
                        if (positions.get(attributes[index]) > positions.get(attributes[next])) {
                            reason = crossingReason(effects[index], effects[next], names[index], names[next]);
                        }
                    }
                }

                if (!reason) {
                    const gap = attributes.findIndex((attribute, index) => index > 0
                        && !/^\s*$/u.test(sourceCode.text.slice(attributes[index - 1].range[1], attribute.range[0])));
                    if (gap !== -1) reason = `Non-whitespace content between "${names[gap - 1]}" and "${names[gap]}" must remain attached to its target.`;
                }

                if (!reason) {
                    const comment = directives.find((entry) => entry.loc.start.line <= node.loc.end.line
                        && entry.loc.end.line + 1 >= node.loc.start.line);
                    if (comment) reason = `A line-sensitive directive comment at line ${comment.loc.start.line} could change targets.`;
                }

                context.report({
                    node: attributes[firstMismatch].key,
                    messageId: reason ? 'manual' : 'order',
                    data: {
                        element: node.parent.rawName,
                        order: sorted.map((entry) => entry.name).join(' → '),
                        expected: sorted[firstMismatch].name,
                        actual: names[firstMismatch],
                        reason: reason,
                    },
                    fix(fixer) {
                        if (reason) return null;
                        return attributes.flatMap((attribute, index) => attribute === sorted[index].attribute ? []
                            : [fixer.replaceText(attribute, sourceCode.getText(sorted[index].attribute))]);
                    },
                });
            },
        });
    },
};
