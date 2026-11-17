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
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class RequireQueryStartForLongChains implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall) {
            return [];
        }

        // PHPStan also visits a synthetic MethodCall for each nullsafe call.
        if ($node->getAttribute('virtualNullsafeMethodCall', false)) {
            return [];
        }

        $queryType = TypeCombinator::union(new ObjectType(Builder::class), new ObjectType(QueryBuilder::class), new ObjectType(Relation::class));
        $root = $node;
        $callCount = 1;

        while ($root instanceof MethodCall || $root instanceof NullsafeMethodCall) {
            if ($root->isFirstClassCallable() || ! $queryType->isSuperTypeOf(TypeCombinator::removeNull($scope->getType($root->var)))->yes()) {
                return [];
            }

            $callCount++;

            // Report only at the third call, even when the chain continues.
            if ($callCount > 3) {
                return [];
            }

            $root = $root->var;
        }

        if ($callCount !== 3 || ! $root instanceof StaticCall || ! $root->name instanceof Identifier || $root->isFirstClassCallable() || strtolower($root->name->toString()) === 'query') {
            return [];
        }

        $modelType = $root->class instanceof Name
            ? $scope->resolveTypeByName($root->class)
            : $scope->getType($root->class)->getObjectTypeOrClassStringObjectType();

        if (! (new ObjectType(Model::class))->isSuperTypeOf($modelType)->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Begin Eloquent query chains of three or more calls with Model::query().')
                ->identifier('workspace.eloquent.enforceQueryUsage')
                ->line($root->getStartLine())
                ->build(),
        ];
    }
}
