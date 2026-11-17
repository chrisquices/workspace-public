import { matchComponentStructure } from '#eslint/helpers/match-component-structure.js';
import { compileComponentStructure } from '#eslint/helpers/compile-component-structure.js';
import { getComponentStructureEntry } from '#eslint/helpers/get-component-structure-entry.js';
import { matchesVueComponentOrRoot } from '#eslint/helpers/matches-vue-component-or-root.js';
import { walkComponentStructure } from '#eslint/helpers/walk-component-structure.js';
import { matchesVueComponentName } from '#eslint/helpers/matches-vue-component-name.js';
import {registerUiComponentRoots} from '#eslint/helpers/get-imported-vue-component-roots.js';
import {checkComponentComments, registerComponentCommentBans} from '#eslint/helpers/check-component-comments.js';
import {checkComponentSpacing} from '#eslint/helpers/check-component-spacing.js';
import { registerComponentSpacingPolicy } from '#eslint/helpers/has-component-spacing-policy.js';
import {checkComponentLayout} from '#eslint/helpers/check-component-layout.js';
import {checkComponentAttributes} from '#eslint/helpers/check-component-attributes.js';
import { checkComponentProps } from '#eslint/helpers/check-component-props.js';
import {checkComponentLabel, labelMessages} from '#eslint/helpers/check-component-label.js';
import { registerComponentLabels } from '#eslint/helpers/get-component-label.js';

// Only active structure rules contribute to each file's trailing component group.
const trailingComponents = new WeakMap();

// One definition produces independently configurable rules for each concern.
export default function createComponentRules(structure, {forbiddenMessage, oncePerFileMessage, propsScope = 'all', commentMatchers = {}, commentPolicy, allowAdditionalParent} = {}) {
    if (!['all', 'root', 'family'].includes(propsScope)) throw new TypeError('propsScope must be all, root, or family.');
    if (!commentMatchers || typeof commentMatchers !== 'object' || Array.isArray(commentMatchers)
        || Object.values(commentMatchers).some((matcher) => typeof matcher !== 'function')) {
        throw new TypeError('commentMatchers must map source component names to matching functions.');
    }
    const root = compileComponentStructure(structure);
    registerComponentLabels(root);
    registerComponentSpacingPolicy(root);
    const family = root.name.toLowerCase();
    const analyses = new WeakMap();
    const allowedParents = new Map();
    const forbidden = new Set();
    const oncePerFile = new Set();
    const occurrences = new WeakMap();
    const pending = [root];

    for (const parent of pending) {
        if (parent.oncePerFile) oncePerFile.add(parent.name);
        for (const child of parent.children ?? []) {
            if (child.special) continue;
            if (child.group) {
                pending.push({...parent, children: child.children});
                continue;
            }
            if (child.forbidden) {
                forbidden.add(child.name);
                continue;
            }
            pending.push(child);

            // Family children follow the root's name; shared components stay usable elsewhere.
            // The root itself can appear anywhere, including inside another family instance.
            if (child.name === root.name || !child.name.startsWith(root.name)) continue;

            if (!allowedParents.has(child.name)) allowedParents.set(child.name, new Set());
            allowedParents.get(child.name).add(parent.name);
        }
    }

    function analyze(sourceCode, node) {
        if (!analyses.has(sourceCode)) analyses.set(sourceCode, new WeakMap());
        const instances = analyses.get(sourceCode);
        if (!instances.has(node)) instances.set(node, matchComponentStructure(getComponentStructureEntry(root, node, sourceCode), node, null, sourceCode));
        return instances.get(node);
    }

    function misplacedParents(sourceCode, node) {
        if (allowAdditionalParent?.(node)) return;
        if (getComponentStructureEntry(root, node, sourceCode)) return;
        // Slot content is placed by the receiving component. Its authored
        // template parent does not identify its rendered component parent.
        if (node.parent?.type === 'VElement' && node.parent.rawName === 'template'
            && node.parent.startTag.attributes.some((attribute) => attribute.directive
                && attribute.key.name.name === 'slot')) return;
        for (const [name, parents] of allowedParents) {
            if (!matchesVueComponentOrRoot(node, name, sourceCode)) continue;
            if ([...parents].some((parent) => matchesVueComponentName(node.parent, parent))) return;
            // Use the same projection as child matching, including explicit-wrapper precedence.
            for (let ancestor = node.parent; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                if (!getComponentStructureEntry(root, ancestor, sourceCode)) continue;
                for (const instance of walkComponentStructure(analyze(sourceCode, ancestor))) {
                    if (parents.has(instance.entry.name) && instance.actual.includes(node)) return;
                }
            }
            return parents;
        }
    }

    function createRule(description, messages, check, {
        fixable,
        type = fixable === 'whitespace' ? 'layout' : 'problem',
        checkElement,
        prepare,
        checkExternal = false,
    } = {}) {
        return {
            meta: {
                type,
                docs: {description},
                schema: [],
                messages,
                ...(fixable ? {fixable} : {}),
            },
            create(context) {
                const sourceCode = context.sourceCode;
                const services = sourceCode.parserServices;
                if (!services.defineTemplateBodyVisitor) return {};
                registerUiComponentRoots(context);
                prepare?.(context);

                return services.defineTemplateBodyVisitor({
                    VElement(node) {
                        checkElement?.(context, node);
                        if (!getComponentStructureEntry(root, node, sourceCode)) return;
                        for (const instance of walkComponentStructure(analyze(sourceCode, node), checkExternal)) check(context, instance);
                    },
                });
            },
        };
    }

    return {
        [`require-valid-${family}-labels`]: createRule(
            `Require declared static labels, icon-relative placement, and dynamic-label visibility within ${root.name}.`,
            labelMessages,
            checkComponentLabel,
            {fixable: 'code'},
        ),

        [`require-valid-${family}-attributes`]: createRule(
            `Enforce declared attribute values and associations within ${root.name}.`,
            {
                attributeRequired: 'Add the required {{ attribute }} attribute or listener to <{{ element }}>. Preserve its behavior and bindings.',
                attributeBound: 'Use :{{ attribute }} on <{{ element }}>; this attribute requires an explicit binding.',
                attributeEmpty: 'Set {{ attribute }} on <{{ element }}> to a nonempty value.',
                attributeValue: 'Set {{ attribute }} on <{{ element }}> to {{ expected }}; received {{ actual }}.',
                attributeMismatch: 'Set {{ attribute }} on <{{ element }}> to the same value or binding as {{ targetAttribute }} on a single <{{ target }}> in the same {{ scope }}.',
            },
            checkComponentAttributes,
        ),

        [`require-valid-${family}-props`]: createRule(
            `Validate ${root.name} family props against their component source.`,
            {
                propMissing: 'Add the required {{ prop }} prop to <{{ element }}>; its component source requires it.',
                propValue: 'Set {{ prop }} on <{{ element }}> to {{ expected }}; received {{ actual }}.',
            },
            (context, instance) => {
                // A nested instance of this root receives its own complete rule pass.
                if (instance.entry !== root && instance.entry.name === root.name) return;
                if (propsScope === 'all' || instance.entry === root
                    || (propsScope === 'family' && instance.entry.name.startsWith(root.name))) checkComponentProps(context, instance);
            },
        ),

        [`require-valid-${family}-comments`]: createRule(
            `Require valid comments within ${root.name}.`,
            {
                commentMissing: 'Add <!-- {{ expected }} --> on its own line immediately above <{{ element }}>.',
                commentManual: 'No comment source provides usable text. Add a standalone comment immediately above <{{ element }}> describing its purpose from the surrounding template.',
                commentMismatch: 'Replace the comment above <{{ element }}> with <!-- {{ expected }} --> to match the first usable comment source.',
                commentFixed: 'Replace the comment above <{{ element }}> with <!-- {{ expected }} -->.',
                commentReferenceMismatch: 'Replace the comment above <{{ element }}> with <!-- {{ expected }} --> to match the comment above <{{ source }}>.',
                commentReferenceUnavailable: 'Cannot copy a comment for <{{ element }}>. Ensure one matching <{{ source }}> in this structure has a standalone comment; the source must be unambiguous.',
                commentSuffix: 'Write a standalone comment immediately above <{{ element }}> ending in {{ suffix }}.',
                directChildComment: 'Remove this comment directly inside <{{ element }}>; direct-child comments are forbidden.',
            },
            (context, instance) => checkComponentComments(context, instance, commentMatchers, commentPolicy),
            {fixable: 'code', checkExternal: true, prepare: (context) => registerComponentCommentBans(context.sourceCode, root)},
        ),

        [`require-${family}-structure`]: createRule(
            `Enforce declared parents, required children, allowed children, and child order for ${root.name}.`,
            {
                forbidden: forbiddenMessage ?? 'Do not use <{{ element }}>; it is forbidden. Replace it while preserving its content and behavior.',
                oncePerFile: oncePerFileMessage ?? 'Use <{{ element }}> only once per file. Consolidate duplicate instances while preserving their content and behavior.',
                topLevel: 'Move <{{ element }}> directly inside the root <template>, outside all wrappers. Preserve its conditions, bindings, and behavior.',
                lastInTemplate: 'Move <{{ element }}> into the trailing group of {{ trailing }} after all other root <template> children. Order within that group is unrestricted. Preserve conditions and bindings.',
                misplaced: 'Move <{{ element }}> directly inside {{ expected }}; currently inside {{ actual }}. Preserve its content and bindings.',
                missing: 'Add <{{ child }}> directly inside <{{ parent }}>{{ placement }}. Preserve existing content and bindings.',
                empty: 'Add content inside <{{ element }}>: text, an interpolation, or a child element.',
                choiceMissing: 'Add exactly one of {{ expected }} directly inside <{{ parent }}>. Preserve existing content and bindings.',
                choiceMultiple: 'Keep exactly one of {{ expected }} directly inside <{{ parent }}>; found {{ actual }}. Preserve existing content and behavior.',
                unexpected: 'Unexpected {{ actual }} directly inside <{{ parent }}>. Move or remove it to match the declared children: {{ expected }}. Preserve existing behavior.',
                firstInParent: 'Move <{{ element }}> to the start of <{{ parent }}>, before all other content. Keep repeated conditional headers together and preserve their conditions and bindings.',
                order: 'Reorder the direct children of <{{ parent }}> as: {{ expected }}. Preserve their content and bindings.',
            },
            (context, instance) => {
                if (instance.entry.firstInParent && instance.parent) {
                    const preceding = instance.parent.actual.filter((child) => child.range[0] < instance.node.range[0]
                        && child.type !== 'VComment' && child.type !== 'VHTMLComment'
                        && !(child.type === 'VText' && /^\s*$/.test(child.value)));
                    if (preceding.some((child) => !matchesVueComponentOrRoot(child, instance.entry.name, context.sourceCode))) {
                        context.report({
                            loc: instance.node.startTag.loc,
                            messageId: 'firstInParent',
                            data: {element: instance.node.rawName, parent: instance.parent.node.rawName},
                        });
                    }
                }
                if (instance.entry.nonEmpty && !instance.hasContent) {
                    context.report({
                        loc: instance.node.startTag.loc,
                        messageId: 'empty',
                        data: {element: instance.node.rawName},
                    });
                }
                for (const choice of instance.choices) {
                    context.report({
                        loc: instance.node.startTag.loc,
                        messageId: choice.members.length ? 'choiceMultiple' : 'choiceMissing',
                        data: {
                            parent: instance.node.rawName,
                            expected: choice.alternatives.map((entry) => `<${entry.name}>`).join(' or '),
                            actual: choice.members.map((member) => `<${member.node.rawName}>`).join(', '),
                        },
                    });
                }
                for (const child of instance.missing) {
                    const siblings = instance.entries;
                    const index = siblings.indexOf(child);
                    const before = instance.children.findLast((sibling) => siblings.indexOf(sibling.entry) < index);
                    const after = instance.children.find((sibling) => siblings.indexOf(sibling.entry) > index);
                    const anchor = before ?? after;
                    let placement = '';

                    if (anchor && !instance.outOfOrder && !instance.entry.unordered) {
                        placement = `, ${before ? 'after' : 'before'} <${anchor.node.rawName}>`;
                        if (instance.children.filter((sibling) => sibling.entry.name === anchor.entry.name).length > 1) {
                            placement += ` at line ${anchor.node.loc.start.line}, column ${anchor.node.loc.start.column + 1}`;
                        }
                    }

                    context.report({
                        loc: instance.node.startTag.loc,
                        messageId: 'missing',
                        data: {
                            parent: instance.node.rawName,
                            child: child.name,
                            placement,
                        },
                    });
                }
                for (const child of instance.unexpected) {
                    // The element visitor gives misplaced family children one specific repair.
                    if (misplacedParents(context.sourceCode, child)
                        || [...forbidden].some((name) => matchesVueComponentOrRoot(child, name, context.sourceCode))) continue;
                    context.report({
                        loc: child.startTag?.loc ?? child.loc,
                        messageId: 'unexpected',
                        data: {
                            parent: instance.node.rawName,
                            actual: child.type === 'VElement'
                                ? `<${child.rawName}>`
                                : 'text or an interpolation',
                            expected: instance.entries
                                .filter((entry) => !entry.special && !entry.forbidden)
                                .map((entry) => `<${entry.name}>`)
                                .join(', ') || 'none',
                        },
                    });
                }
                if (!instance.outOfOrder) return;

                context.report({
                    loc: instance.node.startTag.loc,
                    messageId: 'order',
                    data: {
                        parent: instance.node.rawName,
                        expected: instance.entries
                            .filter((entry) => !entry.special && !entry.forbidden)
                            .flatMap((entry) => {
                                const matches = instance.children.filter((child) => child.entry === entry);
                                return Array(Math.max(matches.length, entry.required ? 1 : 0)).fill(`<${entry.name}>`);
                            })
                            .join(', '),
                    },
                    fix(fixer) {
                        const sourceCode = context.sourceCode;
                        const node = instance.node;
                        const ordered = instance.children.map((child) => child.sourceNode);
                        const original = [...ordered].sort((left, right) => left.range[0] - right.range[0]);
                        const expected = instance.entries.filter((entry) => !entry.special && !entry.forbidden);
                        const presentNames = new Set(instance.children.map((child) => child.entry.name));
                        // Absent optional duplicates cannot make this reorder ambiguous.
                        // Retain every declaration for a present name, even if only
                        // one occurrence matched, because its placement may be unclear.
                        const presentExpected = expected.filter((entry) => presentNames.has(entry.name));
                        const document = sourceCode.parserServices.getDocumentFragment();

                        if (!node.endTag || instance.missing.length || instance.choices.length || instance.unexpected.length
                            || new Set(ordered).size !== ordered.length
                            || new Set(presentExpected.map((entry) => entry.name)).size !== presentExpected.length
                            || document.errors.some((error) => error.code !== 'non-void-html-element-start-tag-with-trailing-solidus')
                            || original.some((child) => child.parent !== node || child.startTag.attributes.some((attribute) =>
                                attribute.directive && ['if', 'else-if', 'else', 'for', 'slot', 'pre'].includes(attribute.key.name.name)))) {
                            return null;
                        }

                        for (let ancestor = node; ancestor?.type === 'VElement'; ancestor = ancestor.parent) {
                            if (['pre', 'textarea', 'script', 'style'].includes(ancestor.rawName)
                                || ancestor.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === 'pre')) return null;
                        }

                        const tokens = sourceCode.parserServices.getTemplateBodyTokenStore();
                        const comments = tokens.getTokensBetween(node.startTag, node.endTag, {includeComments: true})
                            .filter((token) => token.type === 'HTMLComment');

                        // Moving a subtree across lint/region boundaries can change
                        // directive ownership even when its markup is copied intact.
                        if (comments.some((comment) => /\beslint-|\b(?:region|endregion)\b/iu.test(comment.value))) return null;

                        const chunks = new Map();
                        for (const [index, child] of original.entries()) {
                            const previousEnd = original[index - 1]?.range[1] ?? node.startTag.range[1];
                            const leading = comments.filter((comment) => comment.range[0] >= previousEnd && comment.range[1] <= child.range[0]);

                            if (leading.some((comment) => sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim()
                                || sourceCode.lines[comment.loc.end.line - 1].slice(comment.loc.end.column).trim())) return null;

                            const start = leading[0]?.range[0] ?? child.range[0];
                            chunks.set(child, {range: [start, child.range[1]], text: sourceCode.text.slice(start, child.range[1])});
                        }

                        return original.flatMap((child, index) => child === ordered[index] ? [] : [
                            fixer.replaceTextRange(chunks.get(child).range, chunks.get(ordered[index]).text),
                        ]);
                    },
                });
            },
            {
                fixable: 'code',
                prepare(context) {
                    if (!root.lastInTemplate) return;
                    const sourceCode = context.sourceCode;
                    if (!trailingComponents.has(sourceCode)) trailingComponents.set(sourceCode, new Set());
                    trailingComponents.get(sourceCode).add(root.name);
                },
                checkElement(context, node) {
                    for (const name of oncePerFile) {
                        if (!matchesVueComponentOrRoot(node, name, context.sourceCode)) continue;
                        if (!occurrences.has(context)) occurrences.set(context, new Set());
                        const seen = occurrences.get(context);
                        if (seen.has(name)) {
                            context.report({
                                loc: node.startTag.loc,
                                messageId: 'oncePerFile',
                                data: {element: node.rawName},
                            });
                        }
                        seen.add(name);
                    }
                    if (matchesVueComponentName(node, root.name)) {
                        const templateBody = context.sourceCode.ast.templateBody;
                        if (node.parent !== templateBody) {
                            if (root.topLevel) context.report({
                                loc: node.startTag.loc,
                                messageId: 'topLevel',
                                data: {element: node.rawName},
                            });
                            return;
                        }

                        const trailingNames = root.lastInTemplate ? [...trailingComponents.get(context.sourceCode)] : [];
                        if (root.lastInTemplate && templateBody.children.slice(templateBody.children.indexOf(node) + 1).some((child) => (
                            child.type !== 'VComment' && child.type !== 'VHTMLComment'
                            && !(child.type === 'VText' && !child.value.trim())
                            && !trailingNames.some((name) => matchesVueComponentName(child, name))
                        ))) {
                            context.report({
                                loc: node.startTag.loc,
                                messageId: 'lastInTemplate',
                                data: {element: node.rawName, trailing: trailingNames.map((name) => `<${name}>`).join(', ')},
                            });
                        }
                        return;
                    }

                    if ([...forbidden].some((name) => matchesVueComponentOrRoot(node, name, context.sourceCode))) {
                        context.report({
                            loc: node.startTag.loc,
                            messageId: 'forbidden',
                            data: {element: node.rawName, root: root.name},
                        });
                        return;
                    }

                    const parents = misplacedParents(context.sourceCode, node);
                    if (!parents) return;

                    context.report({
                        loc: node.startTag.loc,
                        messageId: 'misplaced',
                        data: {
                            element: node.rawName,
                            expected: [...parents].map((parent) => `<${parent}>`).join(' or '),
                            actual: node.parent?.type === 'VElement'
                                ? `<${node.parent.rawName}>`
                                : 'the template root',
                        },
                    });
                },
            },
        ),

        [`require-${family}-blank-lines`]: createRule(
            `Enforce required and forbidden blank lines within ${root.name}.`,
            {
                spacing: 'Keep exactly one blank line between <{{ before }}> and <{{ after }}>, before any leading comments attached to <{{ after }}>.',
                spacingAbove: 'Keep exactly one blank line above <{{ after }}>, before any leading comments attached to it.',
                edgeSpacing: 'Keep exactly one blank line at this declared BlankLine boundary for <{{ element }}>. Preserve content and keep leading comments attached to their component.',
                siblingSpacing: 'Keep exactly one blank line after <{{ element }}> before the following sibling content. Keep leading comments attached to that content. Do not add padding before the parent closing tag; preserve text-sensitive content and line-sensitive directives when correcting manually.',
                noSpacing: 'Remove blank lines between <{{ before }}> and <{{ after }}>. Preserve content and bindings; move intervening comments if needed.',
                noEdgeSpacing: 'Remove blank lines at the start or end of <{{ element }}> content. Preserve its content.',
            },
            checkComponentSpacing,
            {fixable: 'whitespace', checkExternal: true},
        ),

        [`require-${family}-line-layout`]: createRule(
            `Enforce declared element and attribute line layouts within ${root.name}.`,
            {
                oneLine: 'Write the entire <{{ element }}> on one line, including attributes and content. Preserve text and bindings.',
                multiLine: 'Put the opening tag, content, and closing tag of <{{ element }}> on separate lines. Preserve text and bindings.',
                oneLineAttributes: 'Write the opening tag and attributes of <{{ element }}> on one line. Preserve values and child content.',
                multiLineAttributes: 'Put each attribute of <{{ element }}> on its own indented line below the tag name, with > or /> at the end of the last attribute. Preserve values and child content.',
                selfClosing: 'Write <{{ element }} /> as a self-closing tag. Preserve its attributes.',
                selfClosingContent: '<{{ element }}> must be self-closing. Resolve its child content or comments before converting it to <{{ element }} />.',
            },
            checkComponentLayout,
            {fixable: 'code', type: 'layout'},
        ),
    };
}
