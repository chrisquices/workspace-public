<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\IntersectionType;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\UnionType;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;

/** @implements Rule<Node> */
class NoRouteModelBinding implements Rule
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

        if (! $node instanceof ClassMethod || ! $node->isPublic() || ($node->isMagic() && $node->name->toLowerString() !== '__invoke')) {
            return [];
        }

        $errors = [];
        $modelType = new ObjectType(Model::class);

        foreach ($node->params as $parameter) {
            if ($parameter->type === null || ! $parameter->var instanceof Variable || ! is_string($parameter->var->name)) {
                continue;
            }

            // Inspect explicit native components without including PHPDoc types.
            $types = [$parameter->type];

            while ($types !== []) {
                $type = array_pop($types);

                if ($type instanceof NullableType) {
                    $types[] = $type->type;
                } elseif ($type instanceof UnionType || $type instanceof IntersectionType) {
                    array_push($types, ...$type->types);
                } elseif ($type instanceof Name && $modelType->isSuperTypeOf($scope->resolveTypeByName($type))->yes()) {
                    $errors[] = RuleErrorBuilder::message("Controller action parameter \${$parameter->var->name} must receive a scalar route identifier. Move the Eloquent model lookup to a service.")
                        ->identifier('workspace.controller.noRouteModelBinding')
                        ->line($parameter->getStartLine())
                        ->build();

                    break;
                }
            }
        }

        return $errors;
    }
}
