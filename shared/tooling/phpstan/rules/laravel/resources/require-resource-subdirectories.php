<?php

namespace Workspace\PHPStan\Resources;

use FilesystemIterator;
use PhpParser\Node;
use PHPStan\Analyser\DependencyTracker;
use PHPStan\Analyser\Scope;
use PHPStan\Node\CollectedDataNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<CollectedDataNode> */
class RequireResourceSubdirectories implements Rule
{
    public function getNodeType(): string
    {
        return CollectedDataNode::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $node->get(ResourceDirectoryCollector::class);
        $root = getcwd();

        if ($root === false) {
            return [];
        }

        $directory = $root.'/app/Http/Resources';

        if ($scope instanceof DependencyTracker) {
            $scope->trackValueDependency(ResourceDirectorySnapshot::class, $directory);
        }

        if (! is_dir($directory)) {
            return [];
        }

        $errors = [];

        foreach (new FilesystemIterator($directory, FilesystemIterator::SKIP_DOTS) as $entry) {
            if ($entry->isDir() && ! $entry->isLink()) {
                continue;
            }

            $error = RuleErrorBuilder::message('Only folders may be placed directly in app/Http/Resources/. Move "'.$entry->getFilename().'" into a folder.')
                ->identifier('workspace.resource.requireResourceSubdirectories');

            if ($entry->isFile()) {
                $error->file($entry->getPathname())->line(1);
            }

            $errors[] = $error->build();
        }

        return $errors;
    }
}
