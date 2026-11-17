<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Model;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireHiddenProperty implements Rule
{
    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @param InClassNode $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->getClassReflection()->isSubclassOf(Model::class)) {
            return [];
        }

        $class = $node->getOriginalNode();

        if ($class->getProperty('hidden') !== null) {
            return [];
        }

        foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
            if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'hidden') {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message('Model must explicitly declare a $hidden property.')
                ->identifier('workspace.model.requirePropertyHidden')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
