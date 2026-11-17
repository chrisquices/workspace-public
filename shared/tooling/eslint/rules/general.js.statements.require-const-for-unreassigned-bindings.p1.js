import { createRequire } from "node:module";
const require = createRequire(new URL("./lib/rules/prefer-const.js", import.meta.resolve("eslint/package.json")));
const FixTracker = require("./utils/fix-tracker");
const astUtils = require("./utils/ast-utils");
const PATTERN_TYPE =
    /^(?:.+?Pattern|RestElement|SpreadProperty|ExperimentalRestProperty|Property)$/u;
const DECLARATION_HOST_TYPE =
    /^(?:Program|BlockStatement|StaticBlock|SwitchCase)$/u;
const DESTRUCTURING_HOST_TYPE =
    /^(?:VariableDeclarator|AssignmentExpression)$/u;
function isInitOfForStatement(node) {
    return node.parent.type === "ForStatement" && node.parent.init === node;
}
function canBecomeVariableDeclaration(identifier) {
    let node = identifier.parent;

    while (PATTERN_TYPE.test(node.type)) {
        node = node.parent;
    }

    return (
        node.type === "VariableDeclarator" ||
        (node.type === "AssignmentExpression" &&
            node.parent.type === "ExpressionStatement" &&
            DECLARATION_HOST_TYPE.test(node.parent.parent.type))
    );
}
function isOuterVariableInDestructing(name, initScope) {
    if (
        initScope.through.some(
            ref => ref.resolved && ref.resolved.name === name,
        )
    ) {
        return true;
    }

    const variable = astUtils.getVariableByName(initScope, name);

    if (variable !== null) {
        return variable.defs.some(def => def.type === "Parameter");
    }

    return false;
}
function getDestructuringHost(reference) {
    if (!reference.isWrite()) {
        return null;
    }
    let node = reference.identifier.parent;

    while (PATTERN_TYPE.test(node.type)) {
        node = node.parent;
    }

    if (!DESTRUCTURING_HOST_TYPE.test(node.type)) {
        return null;
    }
    return node;
}
function hasMemberExpressionAssignment(node) {
    switch (node.type) {
        case "ObjectPattern":
            return node.properties.some(prop => {
                if (prop) {
                    /*
                     * Spread elements have an argument property while
                     * others have a value property. Because different
                     * parsers use different node types for spread elements,
                     * we just check if there is an argument property.
                     */
                    return hasMemberExpressionAssignment(
                        prop.argument || prop.value,
                    );
                }

                return false;
            });

        case "ArrayPattern":
            return node.elements.some(element => {
                if (element) {
                    return hasMemberExpressionAssignment(element);
                }

                return false;
            });

        case "AssignmentPattern":
            return hasMemberExpressionAssignment(node.left);

        case "MemberExpression":
            return true;

        // no default
    }

    return false;
}
function getIdentifierIfShouldBeConst(variable, ignoreReadBeforeAssign) {
    if (variable.eslintUsed && variable.scope.type === "global") {
        return null;
    }

    // Finds the unique WriteReference.
    let writer = null;
    let isReadBeforeInit = false;
    const references = variable.references;

    for (let i = 0; i < references.length; ++i) {
        const reference = references[i];

        if (reference.isWrite()) {
            const isReassigned =
                writer !== null && writer.identifier !== reference.identifier;

            if (isReassigned) {
                return null;
            }

            const destructuringHost = getDestructuringHost(reference);

            if (
                destructuringHost !== null &&
                destructuringHost.left !== void 0
            ) {
                const leftNode = destructuringHost.left;
                let hasOuterVariables = false,
                    hasNonIdentifiers = false;

                if (leftNode.type === "ObjectPattern") {
                    const properties = leftNode.properties;

                    hasOuterVariables = properties
                        .filter(prop => prop.value)
                        .map(prop => prop.value.name)
                        .some(name =>
                            isOuterVariableInDestructing(name, variable.scope),
                        );

                    hasNonIdentifiers = hasMemberExpressionAssignment(leftNode);
                } else if (leftNode.type === "ArrayPattern") {
                    const elements = leftNode.elements;

                    hasOuterVariables = elements
                        .map(element => element && element.name)
                        .some(name =>
                            isOuterVariableInDestructing(name, variable.scope),
                        );

                    hasNonIdentifiers = hasMemberExpressionAssignment(leftNode);
                }

                if (hasOuterVariables || hasNonIdentifiers) {
                    return null;
                }
            }

            writer = reference;
        } else if (reference.isRead() && writer === null) {
            if (ignoreReadBeforeAssign) {
                return null;
            }
            isReadBeforeInit = true;
        }
    }

    /*
     * If the assignment is from a different scope, ignore it.
     * If the assignment cannot change to a declaration, ignore it.
     */
    const shouldBeConst =
        writer !== null &&
        writer.from === variable.scope &&
        canBecomeVariableDeclaration(writer.identifier);

    if (!shouldBeConst) {
        return null;
    }

    if (isReadBeforeInit) {
        return variable.defs[0].name;
    }

    return writer.identifier;
}
function groupByDestructuring(variables, ignoreReadBeforeAssign) {
    const identifierMap = new Map();

    for (let i = 0; i < variables.length; ++i) {
        const variable = variables[i];
        const references = variable.references;
        const identifier = getIdentifierIfShouldBeConst(
            variable,
            ignoreReadBeforeAssign,
        );
        let prevId = null;

        for (let j = 0; j < references.length; ++j) {
            const reference = references[j];
            const id = reference.identifier;

            /*
             * Avoid counting a reference twice or more for default values of
             * destructuring.
             */
            if (id === prevId) {
                continue;
            }
            prevId = id;

            // Add the identifier node into the destructuring group.
            const group = getDestructuringHost(reference);

            if (group) {
                if (identifierMap.has(group)) {
                    identifierMap.get(group).push(identifier);
                } else {
                    identifierMap.set(group, [identifier]);
                }
            }
        }
    }

    return identifierMap;
}
function findUp(node, type, shouldStop) {
    if (!node || shouldStop(node)) {
        return null;
    }
    if (node.type === type) {
        return node;
    }
    return findUp(node.parent, type, shouldStop);
}

export default {
    meta: {
        type: "suggestion",
        description: "Use const for bindings that are never reassigned.",
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "useConst": "'{{name}}' is never reassigned. Use 'const' instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"destructuring":"any","ignoreReadBeforeAssign":false}];
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

                const result = change(fixer);
                if (!result) return null;
                const edits = result.range ? [result] : [...result];
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);

                    for (const comment of commentsForFixes) {
                        if (edit.range[0] < comment.range[1] && edit.range[1] > comment.range[0]
                            && !edit.text.includes(sourceForFixes.getText(comment))) return null;
                        if (/eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(comment.value)
                            && /[\r\n]/u.test(before + edit.text)) {
                            const first = sourceForFixes.getLocFromIndex(edit.range[0]).line;
                            const last = sourceForFixes.getLocFromIndex(edit.range[1]).line;
                            if (first <= comment.loc.end.line + 1 && last >= comment.loc.start.line - 1) return null;
                        }
                    }
                }
                return edits;
            };
        }

        const [{ destructuring, ignoreReadBeforeAssign }] = ruleOptions;
        const shouldMatchAnyDestructuredVariable = destructuring !== "all";
        const sourceCode = context.sourceCode;
        const variables = [];
        let reportCount = 0;
        let checkedId = null;
        let checkedName = "";

        /**
         * Reports given identifier nodes if all of the nodes should be declared
         * as const.
         *
         * The argument 'nodes' is an array of Identifier nodes.
         * This node is the result of 'getIdentifierIfShouldBeConst()', so it's
         * nullable. In simple declaration or assignment cases, the length of
         * the array is 1. In destructuring cases, the length of the array can
         * be 2 or more.
         * @param {(Reference|null)[]} nodes
         *      References which are grouped by destructuring to report.
         * @returns {void}
         */
        function checkGroup(nodes) {
            const nodesToReport = nodes.filter(Boolean);

            if (
                nodes.length &&
                (shouldMatchAnyDestructuredVariable ||
                    nodesToReport.length === nodes.length)
            ) {
                const varDeclParent = findUp(
                    nodes[0],
                    "VariableDeclaration",
                    parentNode => parentNode.type.endsWith("Statement"),
                );
                const isVarDecParentNull = varDeclParent === null;

                if (
                    !isVarDecParentNull &&
                    varDeclParent.declarations.length > 0
                ) {
                    const firstDeclaration = varDeclParent.declarations[0];

                    if (firstDeclaration.init) {
                        const firstDecParent = firstDeclaration.init.parent;

                        /*
                         * First we check the declaration type and then depending on
                         * if the type is a "VariableDeclarator" or its an "ObjectPattern"
                         * we compare the name and id from the first identifier, if the names are different
                         * we assign the new name, id and reset the count of reportCount and nodeCount in
                         * order to check each block for the number of reported errors and base our fix
                         * based on comparing nodes.length and nodesToReport.length.
                         */

                        if (firstDecParent.type === "VariableDeclarator") {
                            if (firstDecParent.id.name !== checkedName) {
                                checkedName = firstDecParent.id.name;
                                reportCount = 0;
                            }

                            if (firstDecParent.id.type === "ObjectPattern") {
                                if (firstDecParent.init.name !== checkedName) {
                                    checkedName = firstDecParent.init.name;
                                    reportCount = 0;
                                }
                            }

                            if (firstDecParent.id !== checkedId) {
                                checkedId = firstDecParent.id;
                                reportCount = 0;
                            }
                        }
                    }
                }

                let shouldFix =
                    varDeclParent &&
                    // Don't do a fix unless all variables in the declarations are initialized (or it's in a for-in or for-of loop)
                    (varDeclParent.parent.type === "ForInStatement" ||
                        varDeclParent.parent.type === "ForOfStatement" ||
                        varDeclParent.declarations.every(
                            declaration => declaration.init,
                        )) &&
                    /*
                     * If options.destructuring is "all", then this warning will not occur unless
                     * every assignment in the destructuring should be const. In that case, it's safe
                     * to apply the fix.
                     */
                    nodesToReport.length === nodes.length;

                if (
                    !isVarDecParentNull &&
                    varDeclParent.declarations &&
                    varDeclParent.declarations.length !== 1
                ) {
                    if (
                        varDeclParent &&
                        varDeclParent.declarations &&
                        varDeclParent.declarations.length >= 1
                    ) {
                        /*
                         * Add nodesToReport.length to a count, then comparing the count to the length
                         * of the declarations in the current block.
                         */

                        reportCount += nodesToReport.length;

                        let totalDeclarationsCount = 0;

                        varDeclParent.declarations.forEach(declaration => {
                            if (declaration.id.type === "ObjectPattern") {
                                totalDeclarationsCount +=
                                    declaration.id.properties.length;
                            } else if (declaration.id.type === "ArrayPattern") {
                                totalDeclarationsCount +=
                                    declaration.id.elements.length;
                            } else {
                                totalDeclarationsCount += 1;
                            }
                        });

                        shouldFix =
                            shouldFix && reportCount === totalDeclarationsCount;
                    }
                }

                nodesToReport.forEach(node => {
                    context.report({
                        node,
                        data: node,
                        fix: safeFix(node, shouldFix
                            ? fixer => {
                                    const letKeywordToken =
                                        sourceCode.getFirstToken(
                                            varDeclParent,
                                            t => t.value === varDeclParent.kind,
                                        );

                                    /**
                                     * Extend the replacement range to the whole declaration,
                                     * in order to prevent other fixes in the same pass
                                     * https://github.com/eslint/eslint/issues/13899
                                     */
                                    return new FixTracker(fixer, sourceCode)
                                        .retainRange(varDeclParent.range)
                                        .replaceTextRange(
                                            letKeywordToken.range,
                                            "const",
                                        );
                                }
                            : null),
                        messageId: "useConst"
                    });
                });
            }
        }

        return {
            "Program:exit"() {
                groupByDestructuring(variables, ignoreReadBeforeAssign).forEach(
                    checkGroup,
                );
            },

            VariableDeclaration(node) {
                if (node.kind === "let" && !isInitOfForStatement(node)) {
                    variables.push(...sourceCode.getDeclaredVariables(node));
                }
            },
        };
    },
};
