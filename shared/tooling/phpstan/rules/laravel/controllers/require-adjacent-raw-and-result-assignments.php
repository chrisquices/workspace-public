<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\AssignRef;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Stmt\ClassLike;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Stmt\Expression;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<ClassMethod> */
class RequireAdjacentRawAndResultAssignments implements Rule
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
        $controller = $scope->getClassReflection();
        $namespace = $scope->getNamespace() ?? '';

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller')
            && ! $controller->is(Controller::class)
            && $namespace !== 'App\\Http\\Controllers'
            && ! str_starts_with($namespace, 'App\\Http\\Controllers\\'))) {
            return [];
        }

        return $this->inspectNode($node);
    }

    /** @return list<RuleError> */
    private function inspectNode(Node $node): array
    {
        if ($node instanceof ClassLike) {
            return [];
        }

        $errors = [];

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;

            if ($name === 'stmts' && is_array($children)) {
                array_push($errors, ...$this->inspectStatements($children));
            }

            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node) {
                    array_push($errors, ...$this->inspectNode($child));
                }
            }
        }

        return $errors;
    }

    /**
     * @param array<int, Node> $statements
     * @return list<RuleError>
     */
    private function inspectStatements(array $statements): array
    {
        $rawPositions = [];
        $errors = [];

        foreach ($statements as $position => $statement) {
            if (! $statement instanceof Expression
                || (! $statement->expr instanceof Assign && ! $statement->expr instanceof AssignRef)
                || ! $statement->expr->var instanceof Variable
                || ! is_string($statement->expr->var->name)) {
                continue;
            }

            $assignment = $statement->expr;
            $name = $assignment->var->name;
            $rawName = $name.'Raw';

            if (isset($rawPositions[$rawName])
                && $rawPositions[$rawName] !== $position - 1
                && $this->usesVariable($assignment->expr, $rawName)) {
                $errors[] = RuleErrorBuilder::message("Place \${$name} immediately after \${$rawName}, with no other statements between the two assignments.")
                    ->identifier('workspace.controller.requireAdjacentRawAndResultAssignments')
                    ->line($statement->getStartLine())
                    ->build();
            }

            if (str_ends_with($name, 'Raw')) {
                $rawPositions[$name] = $position;
            }
        }

        return $errors;
    }

    private function usesVariable(Node $node, string $name): bool
    {
        if ($node instanceof ClassLike) {
            return false;
        }

        if ($node instanceof Variable && $node->name === $name) {
            return true;
        }

        foreach ($node->getSubNodeNames() as $subNodeName) {
            $children = $node->$subNodeName;
            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node && $this->usesVariable($child, $name)) {
                    return true;
                }
            }
        }

        return false;
    }
}
