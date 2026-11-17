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
class RequireAllowedProperties implements Rule
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
        $allowed = ['table', 'guarded', 'fillable', 'hidden', 'attributes', 'casts', 'primaryKey', 'timestamps'];
        $declarations = [];

        foreach ($class->getProperties() as $property) {
            foreach ($property->props as $item) {
                $declarations[] = ['name' => $item->name->toString(), 'line' => $item->getStartLine()];
            }
        }

        foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
            if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && is_string($parameter->var->name)) {
                $declarations[] = ['name' => $parameter->var->name, 'line' => $parameter->getStartLine()];
            }
        }

        $errors = [];

        foreach ($declarations as $declaration) {
            if (in_array($declaration['name'], $allowed, true)) {
                continue;
            }

            $errors[] = RuleErrorBuilder::message('Model property $'.$declaration['name'].' is not supported by the model rules. Keep this property and add support for it in require-allowed-properties.php, including any required dedicated rules. Do not remove the property to silence this violation.')
                ->identifier('workspace.model.requirePropertiesToBeAllowed')
                ->line($declaration['line'])
                ->build();
        }

        return $errors;
    }
}
