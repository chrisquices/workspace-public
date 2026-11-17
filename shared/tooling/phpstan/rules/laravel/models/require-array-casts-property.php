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
class RequireArrayCastsProperty implements Rule
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
        $property = $class->getProperty('casts');
        $declaration = null;

        if ($property !== null) {
            foreach ($property->props as $item) {
                if ($item->name->toString() === 'casts') {
                    $declaration = $item;

                    break;
                }
            }
        } else {
            foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'casts') {
                    $declaration = $parameter;

                    break;
                }
            }
        }

        if ($declaration === null) {
            return [];
        }

        $default = $declaration->default;

        if ($default !== null && $scope->getType($default)->isArray()->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('$casts must have an array default.')
                ->identifier('workspace.model.requirePropertyCastsToBeArray')
                ->line(($default ?? $declaration)->getStartLine())
                ->build(),
        ];
    }
}
