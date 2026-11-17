<?php

namespace Workspace\PHPStan\Resources;

use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Collectors\Collector;
use PHPStan\Node\FileNode;

/** @implements Collector<FileNode, bool> */
class ResourceDirectoryCollector implements Collector
{
    public function getNodeType(): string
    {
        return FileNode::class;
    }

    public function processNode(Node $node, Scope $scope): ?bool
    {
        return true;
    }
}
