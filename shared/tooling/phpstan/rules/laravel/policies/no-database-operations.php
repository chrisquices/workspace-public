<?php

namespace Workspace\PHPStan\Policies;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
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
class NoDatabaseOperations implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $namespace = $scope->getNamespace() ?? '';

        if (($namespace !== 'App\\Policies' && ! str_starts_with($namespace, 'App\\Policies\\'))
            || (! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall)
            || ! $node->name instanceof Identifier || $node->isFirstClassCallable()
            || $node->getAttribute('virtualNullsafeMethodCall', false)) {
            return [];
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($node instanceof StaticCall ? $type->getObjectTypeOrClassStringObjectType() : $type);
        $databaseCall = (new ObjectType(Builder::class))->isSuperTypeOf($type)->yes();
        $modelWrite = (new ObjectType(Model::class))->isSuperTypeOf($type)->yes()
            && in_array(strtolower($node->name->toString()), [
                'create', 'forcecreate', 'update', 'delete', 'forcedelete', 'save', 'savequietly',
                'deletequietly', 'restore', 'restorequietly', 'push', 'pushquietly', 'touch',
                'increment', 'decrement', 'incrementquietly', 'decrementquietly',
                'firstorcreate', 'updateorcreate', 'insert', 'insertorignore', 'upsert',
            ], true);

        if (! $databaseCall && ! $modelWrite) {
            return [];
        }

        return [RuleErrorBuilder::message('Policies must delegate database operations to services.')
            ->identifier('workspace.policy.noDatabaseOperations')
            ->line($node->getStartLine())
            ->build()];
    }
}
