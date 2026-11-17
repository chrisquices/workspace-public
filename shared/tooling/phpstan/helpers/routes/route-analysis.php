<?php

namespace Workspace\PHPStan\Routes;

use Illuminate\Routing\RouteRegistrar;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route as RouteFacade;
use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\ArrowFunction;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\Closure;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\FunctionLike;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar\Int_;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Type\Constant\ConstantStringType;
use PHPStan\Type\MixedType;
use PHPStan\Type\ObjectType;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;

trait RouteAnalysis
{
    private const ENDPOINTS = [
        'get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'any', 'match', 'addroute', 'fallback',
        'redirect', 'permanentredirect', 'view', 'inertia', 'resource', 'apiresource', 'resources',
        'apiresources', 'softdeletableresources', 'singleton', 'apisingleton', 'singletons', 'apisingletons',
    ];

    private const ATTRIBUTES = [
        'as', 'name', 'prefix', 'middleware', 'controller', 'domain', 'namespace', 'where', 'can',
        'scopebindings', 'withoutscopedbindings', 'withoutmiddleware', 'missing', 'metadata',
    ];

    /** @phpstan-assert-if-true StaticCall|MethodCall|NullsafeMethodCall $node */
    private function isCall(Node $node): bool
    {
        return $node instanceof StaticCall
            || $node instanceof MethodCall
            || $node instanceof NullsafeMethodCall;
    }

    /** @param StaticCall|MethodCall|NullsafeMethodCall $call */
    private function methodName(Expr $call, Scope $scope): ?string
    {
        if ($call->name instanceof Identifier) {
            return strtolower($call->name->toString());
        }

        $type = $scope->getType($call->name);

        return (count($type->getConstantStrings()) === 1 && $type->isConstantScalarValue()->yes()) ? strtolower($type->getConstantStrings()[0]->getValue()) : null;
    }

    /**
     * Classify the receiver, not the result: Route::get(...)->fallback()
     * modifies a Route and must not be mistaken for Router::fallback(...).
     *
     * @param StaticCall|MethodCall|NullsafeMethodCall $call
     * @return 'router'|'registrar'|null
     */
    private function receiverKind(Expr $call, Scope $scope): ?string
    {
        $receiver = $call instanceof StaticCall ? $call->class : $call->var;

        if ($receiver instanceof Name) {
            $type = $scope->resolveTypeByName($receiver);
        } else {
            $type = $scope->getType($receiver);

            if ($call instanceof StaticCall) {
                $type = $type->getObjectTypeOrClassStringObjectType();
            }
        }

        $type = TypeCombinator::removeNull($type);

        if ((new ObjectType(RouteFacade::class))->isSuperTypeOf($type)->yes()
            || (new ObjectType(Router::class))->isSuperTypeOf($type)->yes()) {
            return 'router';
        }

        if ((new ObjectType(RouteRegistrar::class))->isSuperTypeOf($type)->yes()) {
            return 'registrar';
        }

        // Facade magic methods may have incomplete return types. Follow only
        // Laravel's known fluent operations from a proven routing receiver.
        if ($receiver instanceof Expr && $this->isCall($receiver)
            && ! $receiver->isFirstClassCallable()) {
            $kind = $this->receiverKind($receiver, $scope);
            $method = $this->methodName($receiver, $scope);

            if ($kind !== null && (in_array($method, self::ATTRIBUTES, true)
                || $method === 'attribute' || ($method !== null && str_starts_with($method, 'where'))
                || ($method === 'group' && $kind === 'registrar'))) {
                return 'registrar';
            }
        }

        return null;
    }

    /**
     * @param StaticCall|MethodCall|NullsafeMethodCall $call
     * @param list<string> $names
     */
    private function argument(Expr $call, int $position, array $names): ?Expr
    {
        $unpacked = false;

        foreach ($call->getArgs() as $index => $argument) {
            if ($argument->unpack) {
                $unpacked = true;

                continue;
            }

            if (($argument->name !== null && in_array($argument->name->toString(), $names, true))
                || ($argument->name === null && $index === $position && ! $unpacked)) {
                return $argument->value;
            }
        }

        return null;
    }

    /**
     * Return attributes in effect BEFORE a registration. Registrar writes
     * overwrite earlier values; modifiers after group() cannot affect it.
     *
     * @param StaticCall|MethodCall|NullsafeMethodCall $call
     * @return array{values: array<string, Type>, unknown: bool}
     */
    private function fluentAttributes(Expr $call, Scope $scope): array
    {
        if ($call instanceof StaticCall || $this->receiverKind($call, $scope) === 'router') {
            $values = [];
            $unknown = false;

            return ['values' => $values, 'unknown' => $unknown];
        }

        $previous = $call->var;

        if (! $this->isCall($previous) || $previous->isFirstClassCallable()
            || $this->receiverKind($previous, $scope) === null) {
            // A registrar supplied by a variable/helper has unproven state.
            $values = [];
            $unknown = true;

            return ['values' => $values, 'unknown' => $unknown];
        }

        $attributes = $this->fluentAttributes($previous, $scope);
        $method = $this->methodName($previous, $scope);

        if ($method === null) {
            $values = [];
            $unknown = true;

            return ['values' => $values, 'unknown' => $unknown];
        }

        $key = $method === 'name' ? 'as' : $method;
        // Router/registrar magic attribute methods consume numeric argument
        // zero; unlike real methods they do not bind a named argument.
        $value = $this->argument($previous, 0, []);

        if ($method === 'attribute') {
            $keyExpression = $this->argument($previous, 0, ['key']);
            $keyType = $keyExpression !== null ? $scope->getType($keyExpression) : null;
            $key = ($keyType !== null && count($keyType->getConstantStrings()) === 1 && $keyType->isConstantScalarValue()->yes()) ? $keyType->getConstantStrings()[0]->getValue() : null;
            $key = $key === 'name' ? 'as' : $key;
            $value = $this->argument($previous, 1, ['value']);

            if ($key === null) {
                // An unknown write could replace any previously set value.
                $attributes['unknown'] = true;

                foreach ($attributes['values'] as $attribute => $type) {
                    $attributes['values'][$attribute] = new MixedType;
                }
            }
        }

        if (in_array($key, ['prefix', 'as', 'middleware'], true)) {
            $attributes['values'][$key] = $value !== null ? $scope->getType($value) : new MixedType;
        }

        return $attributes;
    }

    /**
     * @param StaticCall|MethodCall|NullsafeMethodCall $call
     * @return array{
     *     call: StaticCall|MethodCall|NullsafeMethodCall,
     *     attributes: array{values: array<string, Type>, unknown: bool},
     *     callback: Expr|null
     * }
     */
    private function describeGroup(Expr $call, Scope $scope): array
    {
        if ($this->receiverKind($call, $scope) === 'router') {
            $expression = $this->argument($call, 0, ['attributes']);
            $attributes = ['values' => [], 'unknown' => true];

            if ($expression !== null) {
                $type = $scope->getType($expression);
                $attributes['unknown'] = ! $type->isConstantArray()->yes();

                // Laravel's literal group attributes use "as". "name" is a
                // registrar method alias, not an alias inside this array.
                foreach (['prefix', 'as', 'middleware'] as $key) {
                    $offset = new ConstantStringType($key);
                    $presence = $type->hasOffsetValueType($offset);

                    if ($presence->yes()) {
                        $attributes['values'][$key] = $type->getOffsetValueType($offset);
                    } elseif ($presence->maybe()) {
                        $attributes['unknown'] = true;
                    }
                }
            }

            $callback = $this->argument($call, 1, ['routes']);
        } else {
            $attributes = $this->fluentAttributes($call, $scope);
            $callback = $this->argument($call, 0, ['callback']);
        }

        return ['call' => $call, 'attributes' => $attributes, 'callback' => $callback];
    }

    /**
     * Only a closure/arrow passed as the actual group callback establishes
     * routing context. Ordinary closures/functions reset that context.
     *
     * @return list<array{
     *     call: StaticCall|MethodCall|NullsafeMethodCall,
     *     attributes: array{values: array<string, Type>, unknown: bool},
     *     callback: Expr|null
     * }>
     */
    private function enclosingGroups(Node $node, Scope $scope): array
    {
        $groups = [];

        while (($parent = $this->fileNodes->parent($node)) !== null) {
            $node = $parent;

            if (! $node instanceof FunctionLike) {
                continue;
            }

            if (! $node instanceof Closure && ! $node instanceof ArrowFunction) {
                break;
            }

            // Arrow functions retain the enclosing variables but do not add
            // a parent scope in PHPStan, unlike regular closures.
            $outerScope = $node instanceof ArrowFunction ? $scope : $scope->getParentScope();

            if ($outerScope === null) {
                break;
            }

            $callback = $node;
            $parent = $this->fileNodes->parent($callback);

            // Router::group also accepts a literal array of callbacks.
            while ($parent instanceof Node\ArrayItem || $parent instanceof Array_) {
                $callback = $parent;
                $parent = $this->fileNodes->parent($parent);
            }

            $call = $parent instanceof Arg ? ($this->fileNodes->parent($parent)) : null;

            if (! $call instanceof Expr || ! $this->isCall($call) || $call->isFirstClassCallable()
                || $this->methodName($call, $outerScope) !== 'group'
                || $this->receiverKind($call, $outerScope) === null) {
                break;
            }

            $group = $this->describeGroup($call, $outerScope);

            if ($group['callback'] !== $callback) {
                break;
            }

            $groups[] = $group;
            $scope = $outerScope;
        }

        return $groups;
    }

    /** @param StaticCall|MethodCall|NullsafeMethodCall $call */
    private function controllerAction(Expr $call, Scope $scope): ?Name
    {
        $position = match ($this->methodName($call, $scope)) {
            'get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'any' => 1,
            'match', 'addroute' => 2,
            'fallback' => 0,
            default => null,
        };
        $action = $position !== null ? $this->argument($call, $position, ['action']) : null;

        if ($action instanceof Array_ && count($action->items) === 2) {
            [$controller, $methodName] = $action->items;

            if (! $controller->unpack && ! $methodName->unpack && ! $controller->byRef && ! $methodName->byRef
                && ($controller->key === null || ($controller->key instanceof Int_ && $controller->key->value === 0))
                && ($methodName->key === null || ($methodName->key instanceof Int_ && $methodName->key->value === 1))
                && $controller->value instanceof ClassConstFetch && $controller->value->class instanceof Name
                && ! in_array(strtolower($controller->value->class->toString()), ['self', 'static', 'parent'], true)
                && $controller->value->name instanceof Identifier
                && strtolower($controller->value->name->toString()) === 'class'
                && $methodName->value instanceof String_ && $methodName->value->value !== '') {
                return $controller->value->class;
            }
        }

        return null;
    }
}
