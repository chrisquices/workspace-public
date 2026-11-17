<?php

namespace Workspace\PHPStan\Services;

use Illuminate\Http\Request;
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

/** @implements Rule<ClassMethod> */
class NoRequestParameters implements Rule
{
    public function getNodeType(): string
    {
        return ClassMethod::class;
    }

    /**
     * @param ClassMethod $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $namespace = $scope->getNamespace() ?? '';

        if ($namespace !== 'App\\Services' && ! str_starts_with($namespace, 'App\\Services\\')) {
            return [];
        }

        $errors = [];
        $requestType = new ObjectType(Request::class);

        foreach ($node->params as $parameter) {
            if ($parameter->type === null || ! $parameter->var instanceof Variable || ! is_string($parameter->var->name)) {
                continue;
            }

            $types = [$parameter->type];

            while ($types !== []) {
                $type = array_pop($types);

                if ($type instanceof NullableType) {
                    $types[] = $type->type;
                } elseif ($type instanceof UnionType || $type instanceof IntersectionType) {
                    array_push($types, ...$type->types);
                } elseif ($type instanceof Name && $requestType->isSuperTypeOf($scope->resolveTypeByName($type))->yes()) {
                    $errors[] = RuleErrorBuilder::message("Service parameter \${$parameter->var->name} must not be a Request or Form Request. Pass the required values instead.")
                        ->identifier('workspace.service.noRequestParameters')
                        ->line($parameter->getStartLine())
                        ->build();

                    break;
                }
            }
        }

        return $errors;
    }
}
