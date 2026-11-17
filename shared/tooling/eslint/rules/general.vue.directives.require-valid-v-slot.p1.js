import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function getSlotDirectivesOnElement(node) {
    return utils.getDirectives(node, "slot");
}
function getSlotDirectivesOnChildren(node) {
    const groups = [];
    for (const group of utils.iterateChildElementsChains(node)) {
        const slotDirs = group.map((childElement) => childElement.name === "template" ? utils.getDirective(childElement, "slot") : null).filter(utils.isDef);
        if (slotDirs.length > 0) groups.push(slotDirs);
    }
    return groups;
}
function getNormalizedName(node, sourceCode) {
    if (node.key.argument == null) return "default";
    return node.key.modifiers.length === 0 ? sourceCode.getText(node.key.argument) : sourceCode.text.slice(node.key.argument.range[0], node.key.range[1]);
}
function filterSameSlot(vSlotGroups, currentVSlot, currentVSlotVForVars, sourceCode, tokenStore) {
    const currentName = getNormalizedName(currentVSlot, sourceCode);
    return vSlotGroups.map((vSlots) => vSlots.filter((vSlot) => {
        if (getNormalizedName(vSlot, sourceCode) !== currentName) return false;
        const vForExpr = getVSlotVForVariableIfUsingIterationVars(vSlot, utils.getDirective(vSlot.parent.parent, "for"));
        return currentVSlotVForVars && vForExpr ? areVSlotVForVariablesEqual(currentVSlotVForVars, vForExpr, tokenStore) : !currentVSlotVForVars && !vForExpr;
    })).filter((slots) => slots.length > 0);
}
function areVSlotVForVariablesEqual(a, b, tokenStore) {
    if (a.variables.length !== b.variables.length || !isEqual(a.expr.right, b.expr.right)) return false;
    const checkedVarNames = new Set();
    const len = Math.min(a.expr.left.length, b.expr.left.length);
    for (let index = 0; index < len; index++) {
        const aPtn = a.expr.left[index];
        const bPtn = b.expr.left[index];
        const aVar = a.variables.find((v) => aPtn.range[0] <= v.id.range[0] && v.id.range[1] <= aPtn.range[1]);
        const bVar = b.variables.find((v) => bPtn.range[0] <= v.id.range[0] && v.id.range[1] <= bPtn.range[1]);
        if (aVar && bVar) {
            if (aVar.id.name !== bVar.id.name || !isEqual(aPtn, bPtn)) return false;
            checkedVarNames.add(aVar.id.name);
        } else if (aVar || bVar) return false;
    }
    return a.variables.every((v) => checkedVarNames.has(v.id.name) || b.variables.some((bv) => v.id.name === bv.id.name));
    /**
    * Determines whether the two given nodes are considered to be equal.
    */
    function isEqual(a, b) {
        return a.type === b.type && utils.equalTokens(a, b, tokenStore);
    }
}
function getVSlotVForVariableIfUsingIterationVars(vSlot, vFor) {
    const expr = vFor && vFor.value && vFor.value.expression;
    const variables = expr && getUsingIterationVars(vSlot.key.argument, vSlot.parent.parent);
    return expr && variables && variables.length > 0 ? {
        expr,
        variables
    } : null;
}
function getUsingIterationVars(argument, element) {
    const vars = [];
    if (argument && argument.type === "VExpressionContainer") {
        for (const { variable } of argument.references) if (variable != null && variable.kind === "v-for" && variable.id.range[0] > element.startTag.range[0] && variable.id.range[1] < element.startTag.range[1]) vars.push(variable);
    }
    return vars;
}
function isUsingScopeVar(vSlot) {
    const argument = vSlot.key.argument;
    const value = vSlot.value;
    if (argument && value && argument.type === "VExpressionContainer") {
        for (const { variable } of argument.references) if (variable != null && variable.kind === "scope" && variable.id.range[0] > value.range[0] && variable.id.range[1] < value.range[1]) return true;
    }
    return false;
}
function hasInvalidModifiers(vSlot, shouldAllowModifiers) {
    return shouldAllowModifiers ? vSlot.key.argument == null && vSlot.key.modifiers.length > 0 : vSlot.key.modifiers.length > 0;
}

export default {
    meta: {
        type: "problem",
        description: 'Use v-slot with valid ownership, placement, and slot names.',
        includeInReadme: true,
        schema: [],
        messages: {
            "ownerMustBeCustomElement": "'v-slot' directive must be owned by a custom element, but '{{name}}' is not." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "namedSlotMustBeOnTemplate": "Named slots must use '<template>' on a custom element." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "defaultSlotMustBeOnTemplate": "Default slot must use '<template>' on a custom element when there are other named slots." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowDuplicateSlotsOnElement": "An element cannot have multiple 'v-slot' directives." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowDuplicateSlotsOnChildren": "An element cannot have multiple '<template>' elements which are distributed to the same slot." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowArgumentUseSlotParams": "Dynamic argument of 'v-slot' directive cannot use that slot parameter." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "disallowAnyModifier": "'v-slot' directive doesn't support any modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "requireAttributeValue": "'v-slot' directive on a custom element requires that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"allowModifiers":false}];

        const sourceCode = context.sourceCode;
        const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore && sourceCode.parserServices.getTemplateBodyTokenStore();
        const shouldAllowModifiers = (ruleOptions[0] || {}).allowModifiers === true;
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='slot']"(node) {
            const isDefaultSlot = node.key.argument == null || node.key.argument.type === "VIdentifier" && node.key.argument.name === "default";
            const element = node.parent.parent;
            const parentElement = element.parent;
            const ownerElement = element.name === "template" ? parentElement : element;
            if (ownerElement.type === "VDocumentFragment") return;
            const vSlotsOnElement = getSlotDirectivesOnElement(element);
            const vSlotGroupsOnChildren = getSlotDirectivesOnChildren(ownerElement);
            if (!utils.isCustomComponent(ownerElement)) context.report({
                node,
                data: { name: ownerElement.rawName },
                messageId: "ownerMustBeCustomElement"
            });
            if (!isDefaultSlot && element.name !== "template") context.report({
                node,
                messageId: "namedSlotMustBeOnTemplate"
            });
            if (ownerElement === element && vSlotGroupsOnChildren.length > 0) context.report({
                node,
                messageId: "defaultSlotMustBeOnTemplate"
            });
            if (vSlotsOnElement.length >= 2 && vSlotsOnElement[0] !== node) context.report({
                node,
                messageId: "disallowDuplicateSlotsOnElement"
            });
            if (ownerElement === parentElement) {
                const vFor = utils.getDirective(element, "for");
                const vSlotVForVar = getVSlotVForVariableIfUsingIterationVars(node, vFor);
                const vSlotGroupsOfSameSlot = filterSameSlot(vSlotGroupsOnChildren, node, vSlotVForVar, sourceCode, tokenStore);
                if (vSlotGroupsOfSameSlot.length >= 2 && !vSlotGroupsOfSameSlot[0].includes(node)) context.report({
                    node,
                    messageId: "disallowDuplicateSlotsOnChildren"
                });
                if (vFor && !vSlotVForVar) context.report({
                    node,
                    messageId: "disallowDuplicateSlotsOnChildren"
                });
            }
            if (isUsingScopeVar(node)) context.report({
                node,
                messageId: "disallowArgumentUseSlotParams"
            });
            const lastModifier = node.key.modifiers.at(-1);
            if (lastModifier && hasInvalidModifiers(node, shouldAllowModifiers)) context.report({
                node,
                loc: {
                    start: node.key.modifiers[0].loc.start,
                    end: lastModifier.loc.end
                },
                messageId: "disallowAnyModifier"
            });
            if (ownerElement === element && isDefaultSlot && (!node.value || utils.isEmptyValueDirective(node, context) || utils.isEmptyExpressionValueDirective(node, context))) context.report({
                node,
                messageId: "requireAttributeValue"
            });
        } });
    },
};
