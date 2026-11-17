<?php

namespace Workspace\PHPStan\Laravel;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Request as RequestFacade;
use PhpParser\Node;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\StaticPropertyFetch;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Reflection\ReflectionProvider;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class NoRequestOutsideControllers implements Rule
{
    public function __construct(private readonly ReflectionProvider $reflectionProvider) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /**
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $this->isRequestAccess($node, $scope) || $this->isController($scope)) {
            return [];
        }

        return [
            RuleErrorBuilder::message('The request() helper and Request facade may only be used in controllers. Receive the request or required values explicitly.')
                ->identifier('workspace.general.noRequestOutsideControllers')
                ->line($node->getStartLine())
                ->build(),
        ];
    }

    private function isRequestAccess(Node $node, Scope $scope): bool
    {
        if ($node instanceof FuncCall && $node->name instanceof Name) {
            $function = strtolower(ltrim($this->reflectionProvider->resolveFunctionName($node->name, $scope) ?? '', '\\'));

            return $function === 'request';
        }

        if (! $node instanceof StaticCall && ! $node instanceof StaticPropertyFetch && ! $node instanceof ClassConstFetch) {
            return false;
        }

        $receiver = $node->class;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($type->getObjectTypeOrClassStringObjectType());

        return (new ObjectType(RequestFacade::class))->isSuperTypeOf($type)->yes();
    }

    private function isController(Scope $scope): bool
    {
        $class = $scope->getClassReflection();

        if ($class === null) {
            return false;
        }

        if ($class->is('App\\Http\\Controllers\\Controller') || $class->is(Controller::class)) {
            return true;
        }

        $namespace = $scope->getNamespace() ?? '';

        return ($namespace === 'App\\Http\\Controllers' || str_starts_with($namespace, 'App\\Http\\Controllers\\'))
            && str_ends_with(strtolower($class->getName()), 'controller');
    }
}
