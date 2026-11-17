<?php

namespace Workspace\PHPStan\General;

use PhpParser\Node;
use PhpParser\Node\Expr\ArrowFunction;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Node> */
class NoArrowFunctions implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof ArrowFunction) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Use an anonymous function with an explicit return statement. Capture any required outer variables using use (...).')
                ->identifier('workspace.general.noArrowFunctions')
                ->build(),
        ];
    }
}
