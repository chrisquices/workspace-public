<?php

namespace Workspace\PHPStan\General;

use PhpParser\Node;
use PhpParser\Node\Expr\Variable;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Variable> */
class RequireCamelCaseVariables implements Rule
{
    public function getNodeType(): string
    {
        return Variable::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! is_string($node->name)
            || $node->name === 'this'
            || in_array($node->name, Scope::SUPERGLOBAL_VARIABLES, true)
            || preg_match('/^[a-z][a-zA-Z0-9]*$/D', $node->name) === 1) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Variable $'.$node->name.' must use camelCase.')
                ->identifier('workspace.general.requireCamelCaseVariables')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
