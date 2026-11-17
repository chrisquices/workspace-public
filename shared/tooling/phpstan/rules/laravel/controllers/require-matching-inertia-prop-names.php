<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
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
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Reflection\ReflectionProvider;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class RequireMatchingInertiaPropNames implements Rule
{
    public function __construct(private readonly ReflectionProvider $reflectionProvider) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $controller = $scope->getClassReflection();

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller') && ! $controller->is(Controller::class))) {
            return [];
        }

        $props = $this->getInertiaProps($node, $scope);

        if ($props === null) {
            return [];
        }

        $errors = [];

        foreach ($props->items as $item) {
            if ($item->unpack || ! $item->key instanceof String_) {
                continue;
            }

            if (! $item->value instanceof Variable || ! is_string($item->value->name)) {
                continue;
            }

            $propName = $item->key->value;

            if ($propName === $item->value->name) {
                continue;
            }

            $errors[] = RuleErrorBuilder::message("Inertia prop \"{$propName}\" must use the matching local variable \${$propName}. Rename or assign to \${$propName} before rendering, preserving the prop key because it is the frontend contract.")
                ->identifier('workspace.controller.noMismatchedInertiaPropNames')
                ->line($item->value->getStartLine())
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

        $props = null;
        $hasUnpackedArguments = false;

        foreach ($node->getArgs() as $position => $argument) {
            if ($argument->unpack) {
                $hasUnpackedArguments = true;

                continue;
            }

            if ($argument->name?->toString() === 'props' || ($argument->name === null && $position === 1 && ! $hasUnpackedArguments)) {
                $props = $argument->value;

                break;
            }
        }

        // Only inspect explicit arrays; do not trace props supplied through variables.
        return $props instanceof Array_ ? $props : null;
    }
}
