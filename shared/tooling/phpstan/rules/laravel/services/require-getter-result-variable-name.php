<?php

namespace Workspace\PHPStan\Services;

use PhpParser\Node;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\AssignRef;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;
use PHPStan\Type\UnionType;

/** @implements Rule<Node> */
class RequireGetterResultVariableName implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ((! $node instanceof Assign && ! $node instanceof AssignRef)
            || ! $node->var instanceof Variable
            || ! is_string($node->var->name)) {
            return [];
        }

        $call = $node->expr;

        if ((! $call instanceof MethodCall && ! $call instanceof NullsafeMethodCall && ! $call instanceof StaticCall)
            || ! $call->name instanceof Identifier
            || $call->getAttribute('virtualNullsafeMethodCall', false)
            || $call->isFirstClassCallable()) {
            return [];
        }

        $method = $call->name->toString();

        if (preg_match('/^get[A-Z]/', $method) !== 1) {
            return [];
        }

        $receiver = $call instanceof StaticCall ? $call->class : $call->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($call instanceof StaticCall ? $type->getObjectTypeOrClassStringObjectType() : $type);

        if (! $this->isServiceType($type)) {
            return [];
        }

        $expected = lcfirst(substr($method, 3)).'Raw';

        if ($node->var->name === $expected) {
            return [];
        }

        return [
            RuleErrorBuilder::message("The result of {$method}() must be assigned to \${$expected}.")
                ->identifier('workspace.service.requireGetterResultVariableName')
                ->line($node->var->getStartLine())
                ->build(),
        ];
    }

    private function isServiceType(Type $type): bool
    {
        if ($type instanceof UnionType) {
            foreach ($type->getTypes() as $member) {
                if (! $this->isServiceType($member)) {
                    return false;
                }
            }

            return true;
        }

        foreach ($type->getObjectClassReflections() as $class) {
            if ($this->isServiceName($class->getName())) {
                return true;
            }

            foreach ($class->getAncestors() as $ancestor) {
                if ($this->isServiceName($ancestor->getName())) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isServiceName(string $name): bool
    {
        return str_starts_with(strtolower(ltrim($name, '\\')), 'app\\services\\');
    }
}
