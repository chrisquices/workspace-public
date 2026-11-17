<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Response as ResponseFacade;
use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\New_;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Reflection\ReflectionProvider;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;
use Symfony\Component\HttpFoundation\JsonResponse;

/** @implements Rule<Node> */
class NoRawVariablesInJsonResponses implements Rule
{
    public function __construct(private readonly ReflectionProvider $reflectionProvider) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $controller = $scope->getClassReflection();
        $namespace = $scope->getNamespace() ?? '';

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller')
            && ! $controller->is(Controller::class)
            && $namespace !== 'App\\Http\\Controllers'
            && ! str_starts_with($namespace, 'App\\Http\\Controllers\\'))) {
            return [];
        }

        $argument = $this->jsonDataArgument($node, $scope);
        $value = $argument?->value;

        if (! $value instanceof Variable || ! is_string($value->name) || ! str_ends_with($value->name, 'Raw')) {
            return [];
        }

        return [
            RuleErrorBuilder::message("JSON response data must not use variables ending in Raw. Pass a resource result instead of \${$value->name}.")
                ->identifier('workspace.controller.noRawVariablesInJsonResponses')
                ->line($value->getStartLine())
                ->build(),
        ];
    }

    private function jsonDataArgument(Node $node, Scope $scope): ?Arg
    {
        if ($node instanceof New_) {
            $class = $node->class;
            $type = $class instanceof Name ? $scope->resolveTypeByName($class)
                : ($class instanceof Expr ? $scope->getType($class)->getObjectTypeOrClassStringObjectType() : $scope->getType($node));

            return $this->isJsonResponse($type) ? $this->dataArgument($node->getArgs(), 'data') : null;
        }

        if ((! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall && ! $node instanceof StaticCall)
            || ! $node->name instanceof Identifier
            || $node->getAttribute('virtualNullsafeMethodCall', false)
            || $node->isFirstClassCallable()) {
            return null;
        }

        $method = strtolower($node->name->toString());
        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($node instanceof StaticCall ? $type->getObjectTypeOrClassStringObjectType() : $type);

        if ($method === 'json' && $this->isResponseFactory($node, $type, $scope)) {
            return $this->dataArgument($node->getArgs(), 'data');
        }

        if ($this->isJsonResponse($type)) {
            if (($method === 'setdata' && ! $node instanceof StaticCall)
                || ($method === 'fromjsonstring' && $node instanceof StaticCall)) {
                return $this->dataArgument($node->getArgs(), 'data');
            }

            if ($method === 'setjson' && ! $node instanceof StaticCall) {
                return $this->dataArgument($node->getArgs(), 'json');
            }
        }

        return null;
    }

    private function isResponseFactory(MethodCall|NullsafeMethodCall|StaticCall $node, Type $type, Scope $scope): bool
    {
        if ($node instanceof StaticCall) {
            return (new ObjectType(ResponseFacade::class))->isSuperTypeOf($type)->yes();
        }

        if ($node->var instanceof FuncCall && $node->var->name instanceof Name && $node->var->getArgs() === []
            && strtolower($this->reflectionProvider->resolveFunctionName($node->var->name, $scope) ?? '') === 'response') {
            return true;
        }

        return (new ObjectType(ResponseFactory::class))->isSuperTypeOf($type)->yes();
    }

    private function isJsonResponse(Type $type): bool
    {
        return (new ObjectType(JsonResponse::class))->isSuperTypeOf(TypeCombinator::removeNull($type))->yes();
    }

    /** @param list<Arg> $arguments */
    private function dataArgument(array $arguments, string $name): ?Arg
    {
        $unpacked = false;

        foreach ($arguments as $position => $argument) {
            if ($argument->unpack) {
                $unpacked = true;

                continue;
            }

            if ($argument->name?->toString() === $name || ($argument->name === null && $position === 0 && ! $unpacked)) {
                return $argument;
            }
        }

        return null;
    }
}
