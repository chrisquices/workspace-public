<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Node> */
class NoLoops implements Rule
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

        if (! $node instanceof Node\Stmt\For_
            && ! $node instanceof Node\Stmt\Foreach_
            && ! $node instanceof Node\Stmt\While_
            && ! $node instanceof Node\Stmt\Do_) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Controllers must delegate iteration to a service or helper. Move this loop there and call a single service operation from the controller.')
                ->identifier('workspace.controller.noLoopStatements')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
