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
class RequireStringValuesInHiddenProperty implements Rule
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
        $property = $class->getProperty('hidden');
        $declaration = null;

        if ($property !== null) {
            foreach ($property->props as $item) {
                if ($item->name->toString() === 'hidden') {
                    $declaration = $item;

                    break;
                }
            }
        } else {
            foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'hidden') {
                    $declaration = $parameter;

                    break;
                }
            }
        }

        if ($declaration === null || $declaration->default === null) {
            return [];
        }

        $default = $declaration->default;
        $hiddenType = $scope->getType($default);

        if (! $hiddenType->isArray()->yes() || $hiddenType->isIterableAtLeastOnce()->no()) {
            return [];
        }

        if ($hiddenType->getIterableValueType()->isString()->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('$hidden must contain only string values.')
                ->identifier('workspace.model.requirePropertyHiddenToContainOnlyStrings')
                ->line($default->getStartLine())
                ->build(),
        ];
    }
}
