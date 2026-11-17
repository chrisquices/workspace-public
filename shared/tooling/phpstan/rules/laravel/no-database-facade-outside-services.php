<?php

namespace Workspace\PHPStan\Laravel;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use PhpParser\Node;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\StaticPropertyFetch;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class NoDatabaseFacadeOutsideServices implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof StaticCall && ! $node instanceof StaticPropertyFetch && ! $node instanceof ClassConstFetch) {
            return [];
        }

        $namespace = $scope->getNamespace() ?? '';
        $class = $scope->getClassReflection();

        if (($namespace === 'App\\Services' || str_starts_with($namespace, 'App\\Services\\'))
            && $class !== null && str_starts_with(strtolower($class->getName()), 'app\\services\\')) {
            return [];
        }

        if ($class !== null && $class->isSubclassOf(Migration::class)) {
            return [];
        }

        $receiver = $node->class;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($type->getObjectTypeOrClassStringObjectType());

        if (! (new ObjectType(DB::class))->isSuperTypeOf($type)->yes()) {
            return [];
        }

        if ($node instanceof StaticCall
            && $node->name instanceof Identifier
            && strtolower($node->name->toString()) === 'prohibitdestructivecommands'
            && $class !== null
            && $class->isSubclassOf(ServiceProvider::class)) {
            return [];
        }

        return [
            RuleErrorBuilder::message('The DB facade may only be used in services or migrations. Move this usage into the appropriate layer.')
                ->identifier('workspace.service.noDatabaseFacadeOutsideServices')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
