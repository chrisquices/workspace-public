<?php

namespace Workspace\PHPStan\Services;

use PhpParser\Node;
use PhpParser\Node\Identifier;
use PhpParser\Node\Stmt\ClassMethod;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<ClassMethod> */
class RequireVoidWriteMethods implements Rule
{
    public function getNodeType(): string
    {
        return ClassMethod::class;
    }

    /**
     * @param ClassMethod $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $namespace = $scope->getNamespace() ?? '';

        if ($namespace !== 'App\\Services' && ! str_starts_with($namespace, 'App\\Services\\')) {
            return [];
        }

        $method = $node->name->toString();
        $lowerMethod = strtolower($method);

        if (! str_starts_with($lowerMethod, 'store') && ! str_starts_with($lowerMethod, 'update') && ! str_starts_with($lowerMethod, 'delete')) {
            return [];
        }

        if ($node->returnType instanceof Identifier && strtolower($node->returnType->toString()) === 'void') {
            return [];
        }

        return [
            RuleErrorBuilder::message("Service method {$method}() must declare a void return type. Store, update, and delete methods should not return anything; controllers or other callers needing data should fetch it separately.")
                ->identifier('workspace.service.requireVoidWriteMethods')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
