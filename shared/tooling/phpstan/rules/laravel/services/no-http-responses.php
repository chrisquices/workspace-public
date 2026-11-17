<?php

namespace Workspace\PHPStan\Services;

use Inertia\Response as InertiaResponse;
use PhpParser\Node;
use PhpParser\Node\IntersectionType;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\UnionType;
use PHPStan\Analyser\Scope;
use PHPStan\Node\MethodReturnStatementsNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\Type;
use Symfony\Component\HttpFoundation\Response;

/** @implements Rule<Node> */
class NoHttpResponses implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $namespace = $scope->getNamespace() ?? '';

        if ($namespace !== 'App\\Services' && ! str_starts_with($namespace, 'App\\Services\\')) {
            return [];
        }

        if ($node instanceof ClassMethod) {
            if ($node->returnType === null || ! $this->containsForbiddenDeclaration($node->returnType, $scope)) {
                return [];
            }

            return [$this->error($node->returnType->getStartLine())];
        }

        if (! $node instanceof MethodReturnStatementsNode || $this->isForbiddenType($node->getMethodReflection()->getNativeReturnType())) {
            return [];
        }

        $errors = [];

        foreach ($node->getReturnStatements() as $statement) {
            $return = $statement->getReturnNode();

            if ($return->expr !== null && $this->isForbiddenType($statement->getScope()->getType($return->expr))) {
                $errors[] = $this->error($return->getStartLine());
            }
        }

        return $errors;
    }

    private function containsForbiddenDeclaration(Node $type, Scope $scope): bool
    {
        if ($type instanceof NullableType) {
            return $this->containsForbiddenDeclaration($type->type, $scope);
        }

        if ($type instanceof UnionType || $type instanceof IntersectionType) {
            foreach ($type->types as $member) {
                if ($this->containsForbiddenDeclaration($member, $scope)) {
                    return true;
                }
            }

            return false;
        }

        return $type instanceof Name && $this->isForbiddenType($scope->resolveTypeByName($type));
    }

    private function isForbiddenType(Type $type): bool
    {
        foreach ($type->getObjectClassReflections() as $class) {
            if ($class->is(Response::class) || $class->is(InertiaResponse::class)) {
                return true;
            }
        }

        return false;
    }

    private function error(int $line): RuleError
    {
        return RuleErrorBuilder::message('Services must not return HTTP or Inertia responses. Return raw data and create the response in the controller or another caller.')
            ->identifier('workspace.service.noHttpResponses')
            ->line($line)
            ->build();
    }
}
