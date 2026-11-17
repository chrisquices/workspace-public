export function getVueTemplateRoot(sourceCode) {
    const children = sourceCode.ast.templateBody?.children.filter((child) => (
        child.type !== 'VComment' && child.type !== 'VHTMLComment'
        && !(child.type === 'VText' && !child.value.trim())
    ));
    if (children?.length !== 1) return undefined;
    const root = children[0];
    if (root.type !== 'VElement' || ['component', 'slot', 'template'].includes(root.rawName)
        || root.startTag.attributes.some((attribute) => attribute.directive
            && ['if', 'else-if', 'else', 'for', 'pre'].includes(attribute.key.name.name))) return undefined;
    return root;
}
