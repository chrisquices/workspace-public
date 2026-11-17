<?php

namespace Workspace\PHPStan\Eloquent;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use PhpParser\Node;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;
use PHPStan\Type\UnionType;

/** @implements Rule<Node> */
class RequireArraySelectArguments implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall && ! $node instanceof StaticCall) {
            return [];
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || ! $node->name instanceof Identifier || strtolower($node->name->toString()) !== 'select' || $node->isFirstClassCallable()) {
            return [];
        }

        $arguments = $node->getArgs();

        if ($arguments === []) {
            return [];
        }

        $receiverType = $node instanceof StaticCall
            ? ($node->class instanceof Name
                ? $scope->resolveTypeByName($node->class)
                : $scope->getType($node->class)->getObjectTypeOrClassStringObjectType())
            : TypeCombinator::removeNull($scope->getType($node->var));
        $queryType = TypeCombinator::union(new ObjectType(Model::class), new ObjectType(Builder::class), new ObjectType(QueryBuilder::class), new ObjectType(Relation::class));

        if (! $queryType->isSuperTypeOf($receiverType)->yes()) {
            return [];
        }

        if (count($arguments) === 1 && ! $arguments[0]->unpack) {
            $argumentType = $scope->getType($arguments[0]->value);
            $argumentTypes = $argumentType instanceof UnionType ? $argumentType->getTypes() : [$argumentType];

            if (array_filter($argumentTypes, static function (Type $type): bool {
                return $type->isArray()->no();
            }) === []) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message("Pass select() columns as a single array, e.g. select(['id', 'name']).")
                ->identifier('workspace.eloquent.enforceArraySelectArguments')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
