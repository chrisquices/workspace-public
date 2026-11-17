<?php

namespace Workspace\PHPStan\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use PhpParser\Node;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\NullsafePropertyFetch;
use PhpParser\Node\Expr\PropertyFetch;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Scalar\String_;
use PhpParser\Node\Stmt\ClassLike;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Stmt\Expression;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<ClassMethod> */
class RequireResourceVariableAssignment implements Rule
{
    public function getNodeType(): string
    {
        return ClassMethod::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $class = $scope->getClassReflection();

        if ($class === null || ! $class->isSubclassOf(JsonResource::class) || strtolower($node->name->toString()) !== 'toarray' || $node->stmts === null) {
            return [];
        }

        $first = $node->stmts[0] ?? null;
        $assignment = $first instanceof Expression ? $first->expr : null;
        $hasInitialAssignment = $assignment instanceof Assign
            && $assignment->var instanceof Variable
            && is_string($assignment->var->name)
            && ! in_array($assignment->var->name, ['this', 'GLOBALS', '_SERVER', '_GET', '_POST', '_FILES', '_COOKIE', '_SESSION', '_REQUEST', '_ENV'], true)
            && $assignment->expr instanceof PropertyFetch
            && $this->isResourceProperty($assignment->expr);
        $errors = [];

        if (! $hasInitialAssignment) {
            $errors[] = RuleErrorBuilder::message('The first statement in a resource toArray() method must assign $this->resource to a local variable.')
                ->identifier('workspace.resource.requireResourceVariableAssignment')
                ->line($first?->getStartLine() ?? $node->getStartLine())
                ->build();
        }

        foreach ($node->stmts as $index => $statement) {
            foreach ($this->findDirectPropertyAccesses($statement) as $access) {
                $isResourceProperty = $this->isResourceProperty($access);

                if ($index === 0 && $isResourceProperty) {
                    continue;
                }

                $message = $isResourceProperty
                    ? 'Use the local resource variable instead of accessing $this->resource directly.'
                    : 'Do not access properties through $this in a resource toArray(). Use the local resource variable instead.';

                $errors[] = RuleErrorBuilder::message($message)
                    ->identifier('workspace.resource.requireResourceVariableAssignment')
                    ->line($access->getStartLine())
                    ->build();
            }
        }

        return $errors;
    }

    private function isResourceProperty(Node $node): bool
    {
        return ($node instanceof PropertyFetch || $node instanceof NullsafePropertyFetch)
            && $node->var instanceof Variable
            && $node->var->name === 'this'
            && (($node->name instanceof Identifier && $node->name->toString() === 'resource')
                || ($node->name instanceof String_ && $node->name->value === 'resource'));
    }

    /** @return list<Node> */
    private function findDirectPropertyAccesses(Node $node): array
    {
        if ($node instanceof ClassLike) {
            return [];
        }

        $accesses = [];

        if (($node instanceof PropertyFetch || $node instanceof NullsafePropertyFetch)
            && $node->var instanceof Variable
            && $node->var->name === 'this') {
            $accesses[] = $node;
        }

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;
            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node) {
                    array_push($accesses, ...$this->findDirectPropertyAccesses($child));
                }
            }
        }

        return $accesses;
    }
}
