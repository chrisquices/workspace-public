<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Routing\Controller;
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
class NoEloquentQueries implements Rule
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

        if ((! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall) || ! $node->name instanceof Identifier) {
            return [];
        }

        // PHPStan also visits a synthetic MethodCall for each nullsafe call.
        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable()) {
            return [];
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $receiverType = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

        // Model receivers are already reported by NoModelUsage.
        $modelReceiverType = $node instanceof StaticCall && ! $receiver instanceof Name
            ? $receiverType->getObjectTypeOrClassStringObjectType()
            : $receiverType;

        if (! $node->getAttribute('virtualNullsafePropertyFetch', false)) {
            foreach ($modelReceiverType->getObjectClassReflections() as $class) {
                if ($class->is(Model::class)) {
                    return [];
                }
            }
        }

        if ($node instanceof StaticCall) {
            $receiverType = $receiverType->getObjectTypeOrClassStringObjectType();
        }

        $receiverType = TypeCombinator::removeNull($receiverType);
        $eloquentType = TypeCombinator::union(
            new ObjectType(Model::class),
            new ObjectType(Builder::class),
            new ObjectType(Relation::class),
        );

        if (! $eloquentType->isSuperTypeOf($receiverType)->yes()) {
            return [];
        }

        $queryType = TypeCombinator::union(
            new ObjectType(Builder::class),
            new ObjectType(Relation::class),
            new ObjectType(QueryBuilder::class),
        );
        $constructsQuery = $queryType->isSuperTypeOf(TypeCombinator::removeNull($scope->getType($node)))->yes();
        $retrievesData = false;
        $methodName = $node->name->toString();

        // Terminal reads do not share a return type: they can return models,
        // collections, paginators, scalars, or the result of a callback.
        if (in_array(strtolower($methodName), [
            'all', 'get', 'getmodels', 'getresults', 'fromquery',
            'find', 'findmany', 'findsole', 'findorfail', 'findor',
            'first', 'firstorfail', 'firstor', 'sole',
            'value', 'valueorfail', 'solevalue', 'rawvalue', 'pluck', 'modelkeys', 'implode',
            'paginate', 'simplepaginate', 'cursorpaginate', 'cursor',
            'chunk', 'chunkmap', 'chunkbyid', 'chunkbyiddesc', 'orderedchunkbyid', 'each', 'eachbyid',
            'lazy', 'lazybyid', 'lazybyiddesc',
            'aggregate', 'numericaggregate', 'count', 'getcountforpagination', 'sum', 'min', 'max', 'avg', 'average',
            'exists', 'existsor', 'doesntexist', 'doesntexistor',
            'fresh', 'refresh', 'refreshforupdate', 'load', 'loadmissing', 'loadmorph',
            'loadaggregate', 'loadcount', 'loadmin', 'loadmax', 'loadsum', 'loadavg', 'loadexists',
            'loadmorphaggregate', 'loadmorphcount', 'loadmorphmin', 'loadmorphmax', 'loadmorphsum', 'loadmorphavg',
        ], true) && $receiverType->hasMethod($methodName)->yes()) {
            $method = $receiverType->getMethod($methodName, $scope);

            // A custom model helper with the same name is not necessarily a query.
            $retrievesData = str_starts_with($method->getDeclaringClass()->getName(), 'Illuminate\\Database\\')
                || str_starts_with($method->getPrototype()->getDeclaringClass()->getName(), 'Illuminate\\Database\\');
        }

        if (! $constructsQuery && ! $retrievesData) {
            return [];
        }

        return [
            RuleErrorBuilder::message("Controllers must delegate Eloquent queries to services. Move this {$methodName}() call into a service.")
                ->identifier('workspace.controller.noEloquentQueries')
                ->build(),
        ];
    }
}
