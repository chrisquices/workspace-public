const blockNames = ['script', 'template', 'style'];

export function getVueBlocks(context) {
    const sourceCode = context.sourceCode;
    const document = sourceCode.parserServices.getDocumentFragment?.();

    if (!document) {
        return null;
    }

    const blocks = document.children.filter(function (node) {
        return node.type === 'VElement' && blockNames.includes(node.rawName);
    });
    // Vue permits self-closing components, though the HTML parser records this
    // diagnostic. Native vue/no-parsing-error also ignores it by default.
    const canFixStructure = document.errors.every(function (error) {
        return error.code === 'non-void-html-element-start-tag-with-trailing-solidus';
    }) && blocks.every(function (block) {
        return block.endTag || block.startTag.selfClosing;
    });

    return {
        sourceCode: sourceCode,
        blockNames: blockNames,
        blocks: blocks,
        canFixStructure: canFixStructure,
        newline: sourceCode.text.includes('\r\n') ? '\r\n' : '\n',
        canFixEmptyScript(block) {
            const contentEnd = block.endTag?.range[0] ?? block.startTag.range[1];
            const content = sourceCode.text.slice(block.startTag.range[1], contentEnd);
            const hasSource = block.startTag.attributes.some(function (attribute) {
                return !attribute.directive && attribute.key.name === 'src';
            });
            const hasOtherSetup = blocks.some(function (other) {
                return other !== block && other.rawName === 'script' && other.startTag.attributes.some(function (attribute) {
                    return !attribute.directive && attribute.key.name === 'setup';
                });
            });

            return canFixStructure && !content.trim() && !hasSource && !hasOtherSetup;
        },
    };
}
