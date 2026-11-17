<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\ResponseFactory;
use PhpParser\Node;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class RequireExplicitInertiaPropsArray implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $this->isInertiaRender($node, $scope)) {
            return [];
        }

        $props = null;
        $unpacked = false;

        foreach ($node->getArgs() as $position => $argument) {
            if ($argument->unpack) {
                $unpacked = true;

                continue;
            }

            if ($argument->name?->toString() === 'props' || ($argument->name === null && $position === 1 && ! $unpacked)) {
                $props = $argument->value;

                break;
            }
        }

        if (! $props instanceof Array_) {
            return [
                RuleErrorBuilder::message('Pass props to Inertia::render() as an explicit array, including [] when there are no props.')
                    ->identifier('workspace.inertia.requireExplicitInertiaPropsArray')
                    ->line($props?->getStartLine() ?? $node->getStartLine())
                    ->build(),
            ];
        }

        $class = $scope->getClassReflection();
        $controllerRulesApply = $class !== null && ($class->is('App\\Http\\Controllers\\Controller') || $class->is(Controller::class));
        $errors = [];

        foreach ($props->items as $item) {
            if ($item->unpack || ! $item->key instanceof String_ || preg_match('/^[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*$/D', $item->key->value) !== 1) {
                $errors[] = RuleErrorBuilder::message('Inertia props must use explicit string keys that can match local variable names. Do not use spreads or unkeyed entries.')
                    ->identifier('workspace.inertia.requireExplicitInertiaPropsArray')
                    ->line($item->getStartLine())
                    ->build();

                continue;
            }

            // Controller-specific rules already report value and name violations.
            if ($controllerRulesApply) {
                continue;
            }

            if (! $item->value instanceof Variable || ! is_string($item->value->name) || $item->value->name !== $item->key->value) {
                $errors[] = RuleErrorBuilder::message('Each Inertia prop value must be a plain named variable matching its key.')
                    ->identifier('workspace.inertia.requireExplicitInertiaPropsArray')
                    ->line($item->value->getStartLine())
                    ->build();
            }
        }

        return $errors;
    }

    /** @phpstan-assert-if-true StaticCall|MethodCall|NullsafeMethodCall $node */
    private function isInertiaRender(Node $node, Scope $scope): bool
    {
        if (! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall) {
            return false;
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable() || ! $node->name instanceof Identifier || strtolower($node->name->toString()) !== 'render') {
            return false;
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $receiverType = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

        if ($node instanceof StaticCall) {
            $receiverType = $receiverType->getObjectTypeOrClassStringObjectType();
        }

        $inertiaType = new ObjectType($node instanceof StaticCall ? Inertia::class : ResponseFactory::class);

        return $inertiaType->isSuperTypeOf(TypeCombinator::removeNull($receiverType))->yes();
    }
}
