<?php

namespace Workspace\PHPStan\Controllers;

use Inertia\Inertia;
use Inertia\ResponseFactory;
use PhpParser\Node;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Reflection\ReflectionProvider;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class NoRawVariablesInInertiaProps implements Rule
{
    public function __construct(private readonly ReflectionProvider $reflectionProvider) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $props = $this->getInertiaProps($node, $scope);

        if ($props === null) {
            return [];
        }

        $errors = [];

        foreach ($props->items as $item) {
            $value = $item->value;

            if ($item->unpack || ! $value instanceof Variable || ! is_string($value->name) || ! str_ends_with($value->name, 'Raw')) {
                continue;
            }

            $errors[] = RuleErrorBuilder::message("Inertia props must not use variables ending in Raw. Pass a resource result instead of \${$value->name}.")
                ->identifier('workspace.inertia.noRawVariablesInInertiaProps')
                ->line($value->getStartLine())
                ->build();
        }

        return $errors;
    }

    private function getInertiaProps(Node $node, Scope $scope): ?Array_
    {
        if (! $node instanceof FuncCall && ! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall) {
            return null;
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable()) {
            return null;
        }

        if ($node instanceof FuncCall) {
            if (! $node->name instanceof Name || strtolower($this->reflectionProvider->resolveFunctionName($node->name, $scope) ?? '') !== 'inertia') {
                return null;
            }
        } else {
            if (! $node->name instanceof Identifier || strtolower($node->name->toString()) !== 'render') {
                return null;
            }

            $receiver = $node instanceof StaticCall ? $node->class : $node->var;
            $receiverType = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

            if ($node instanceof StaticCall) {
                $receiverType = $receiverType->getObjectTypeOrClassStringObjectType();
            }

            $inertiaType = new ObjectType($node instanceof StaticCall ? Inertia::class : ResponseFactory::class);

            if (! $inertiaType->isSuperTypeOf(TypeCombinator::removeNull($receiverType))->yes()) {
                return null;
            }
        }

        $hasUnpackedArguments = false;

        foreach ($node->getArgs() as $position => $argument) {
            if ($argument->unpack) {
                $hasUnpackedArguments = true;

                continue;
            }

            if ($argument->name?->toString() === 'props' || ($argument->name === null && $position === 1 && ! $hasUnpackedArguments)) {
                return $argument->value instanceof Array_ ? $argument->value : null;
            }
        }

        return null;
    }
}
