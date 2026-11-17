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
class RequireValidTimestampsProperty implements Rule
{
    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @param  InClassNode  $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->getClassReflection()->isSubclassOf(Model::class)) {
            return [];
        }

        $class = $node->getOriginalNode();
        $property = $class->getProperty('timestamps');
        $declaration = null;

        if ($property !== null) {
            foreach ($property->props as $item) {
                if ($item->name->toString() === 'timestamps') {
                    $declaration = $item;

                    break;
                }
            }
        } else {
            foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'timestamps') {
                    $property = $parameter;
                    $declaration = $parameter;

                    break;
                }
            }
        }

        if ($property === null || $declaration === null) {
            return [];
        }

        if ($property->isPublic() && ! ($property instanceof Node\Stmt\Property && $property->isStatic()) && $declaration->default !== null
            && $scope->getType($declaration->default)->isBoolean()->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('$timestamps must be a public instance property with a boolean default.')
                ->identifier('workspace.model.requireValidTimestampsProperty')
                ->line($declaration->getStartLine())
                ->build(),
        ];
    }
}
