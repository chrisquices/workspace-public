<?php

namespace Workspace\PHPStan\Routes;

use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\FileNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;

/** @implements Rule<FileNode> */
class FileNodeIndex implements Rule
{
    /** @var \WeakMap<Node, Node> */
    private \WeakMap $parents;

    private ?FileNode $fileNode = null;

    private ?string $file = null;

    public function __construct()
    {
        $this->parents = new \WeakMap;
    }

    public function getNodeType(): string
    {
        return FileNode::class;
    }

    /**
     * @param FileNode $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $this->fileNode = $node;
        $this->file = $scope->getFile();
        $this->parents = new \WeakMap;
        $root = getcwd();

        if ($root !== false && str_starts_with(
            str_replace('\\', '/', $this->file),
            rtrim(str_replace('\\', '/', $root), '/').'/routes/',
        )) {
            foreach ($node->getNodes() as $statement) {
                $this->indexParents($statement, $node);
            }
        }

        return [];
    }

    public function contains(Node $node, string $file): bool
    {
        return $this->file === $file && isset($this->parents[$node]);
    }

    public function parent(Node $node): ?Node
    {
        return $this->parents[$node] ?? null;
    }

    public function fileNode(): ?FileNode
    {
        return $this->fileNode;
    }

    private function indexParents(Node $node, Node $parent): void
    {
        $this->parents[$node] = $parent;

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;

            foreach (is_array($children) ? $children : [$children] as $child) {
                if ($child instanceof Node) {
                    $this->indexParents($child, $node);
                }
            }
        }
    }
}
