<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Node> */
class RequireNamedMethodArguments implements Rule
{
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

        if (! $node instanceof MethodCall && ! $node instanceof StaticCall && ! $node instanceof NullsafeMethodCall) {
            return [];
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable()) {
            return [];
        }

        $errors = [];

        foreach ($node->getRawArgs() as $argument) {
            if (! $argument instanceof Node\Arg || (! $argument->unpack && $argument->name !== null)) {
                continue;
            }

            $message = $argument->unpack
                ? 'Method calls in controllers must use explicit named arguments. Replace argument unpacking with arguments named at the call site.'
                : 'Method calls in controllers must use named arguments. Replace this positional argument with a named argument using the actual declared parameter name.';

            $errors[] = RuleErrorBuilder::message($message)
                ->identifier('workspace.controller.noPositionalArguments')
                ->line($argument->getStartLine())
                ->build();
        }

        return $errors;
    }
}
