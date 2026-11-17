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
class RequireStringKeysInAttributesProperty implements Rule
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
        $property = $class->getProperty('attributes');
        $declaration = null;

        if ($property !== null) {
            foreach ($property->props as $item) {
                if ($item->name->toString() === 'attributes') {
                    $declaration = $item;

                    break;
                }
            }
        } else {
            foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'attributes') {
                    $declaration = $parameter;

                    break;
                }
            }
        }

        if ($declaration === null || $declaration->default === null) {
            return [];
        }

        $default = $declaration->default;
        $attributesType = $scope->getType($default);

        if (! $attributesType->isArray()->yes() || $attributesType->isIterableAtLeastOnce()->no()) {
            return [];
        }

        if ($attributesType->getIterableKeyType()->isString()->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('$attributes must use string attribute names as array keys.')
                ->identifier('workspace.model.requirePropertyAttributesToHaveStringKeys')
                ->line($default->getStartLine())
                ->build(),
        ];
    }
}
