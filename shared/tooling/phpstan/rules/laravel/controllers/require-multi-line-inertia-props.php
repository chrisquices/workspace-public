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
class RequireMultiLineInertiaProps implements Rule
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

        $previousEndLine = $props->getStartLine();

        foreach ($props->items as $item) {
            if ($item->getStartLine() <= $previousEndLine
                || $item->getStartLine() !== $item->getEndLine()
                || $item->getEndLine() >= $props->getEndLine()) {
                return [
                    RuleErrorBuilder::message('Put each Inertia prop on its own line between the opening and closing array brackets, with the closing bracket on its own line.')
                        ->identifier('workspace.controller.noInlineInertiaProps')
                        ->line($item->getStartLine())
                        ->build(),
                ];
            }

            $previousEndLine = $item->getEndLine();
        }

        return [];
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
