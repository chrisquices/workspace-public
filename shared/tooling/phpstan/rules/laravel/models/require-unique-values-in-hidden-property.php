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
class RequireUniqueValuesInHiddenProperty implements Rule
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

        $arrays = $hiddenType->getConstantArrays();

        if (! $hiddenType->isConstantArray()->yes() || count($arrays) !== 1) {
            return [];
        }

        $hiddenType = $arrays[0];

        $seen = [];
        $optionalKeys = $hiddenType->getOptionalKeys();

        foreach ($hiddenType->getValueTypes() as $index => $valueType) {
            // Only required, concrete values prove that repeated entries coexist.
            if (in_array($index, $optionalKeys, true) || ! (count($valueType->getConstantStrings()) === 1 && $valueType->isConstantScalarValue()->yes())) {
                continue;
            }

            $value = $valueType->getConstantStrings()[0]->getValue();

            if (in_array($value, $seen, true)) {
                return [
                    RuleErrorBuilder::message('$hidden must contain unique values. Remove the repeated "'.$value.'" entry.')
                        ->identifier('workspace.model.requirePropertyHiddenToHaveUniqueValues')
                        ->line($default->getStartLine())
                        ->build(),
                ];
            }

            $seen[] = $value;
        }

        return [];
    }
}
