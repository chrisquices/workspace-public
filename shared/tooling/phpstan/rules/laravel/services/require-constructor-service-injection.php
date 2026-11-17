<?php

namespace Workspace\PHPStan\Services;

use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Facades\App;
use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\ArrowFunction;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\Closure;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\New_;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\IntersectionType;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Stmt\Function_;
use PhpParser\Node\UnionType;
use PHPStan\Analyser\Scope;
use PHPStan\Reflection\ReflectionProvider;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class RequireConstructorServiceInjection implements Rule
{
    public function __construct(private readonly ReflectionProvider $reflectionProvider) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ($node instanceof ClassMethod || $node instanceof Function_ || $node instanceof Closure || $node instanceof ArrowFunction) {
            if ($node instanceof ClassMethod && strtolower($node->name->toString()) === '__construct') {
                return [];
            }

            return $this->checkParameters($node->params, $scope);
        }

        if ($node instanceof New_) {
            $type = $node->class instanceof Name
                ? $scope->resolveTypeByName($node->class)
                : ($node->class instanceof Expr ? $scope->getType($node->class)->getObjectTypeOrClassStringObjectType() : null);

            return $type !== null && $this->isServiceType($type) ? [$this->resolutionError($node)] : [];
        }

        if ($node instanceof FuncCall) {
            if (! $node->name instanceof Name || $node->isFirstClassCallable()) {
                return [];
            }

            $name = strtolower($this->reflectionProvider->resolveFunctionName($node->name, $scope) ?? '');

            if (! in_array($name, ['app', 'resolve'], true)) {
                return [];
            }

            $argument = $this->serviceArgument($node->getArgs(), $name === 'app' ? ['abstract'] : ['name']);

            return $argument !== null && $this->isServiceReference($argument, $scope) ? [$this->resolutionError($node)] : [];
        }

        if (! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall && ! $node instanceof StaticCall) {
            return [];
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable() || ! $node->name instanceof Identifier) {
            return [];
        }

        $method = strtolower($node->name->toString());

        if (! in_array($method, ['make', 'makewith', 'get', 'resolve', 'build'], true)) {
            return [];
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($node instanceof StaticCall ? $type->getObjectTypeOrClassStringObjectType() : $type);
        $isContainer = (new ObjectType(Container::class))->isSuperTypeOf($type)->yes()
            || ($node instanceof StaticCall && (new ObjectType(App::class))->isSuperTypeOf($type)->yes());

        if (! $isContainer) {
            return [];
        }

        $argument = $this->serviceArgument($node->getArgs(), ['abstract', 'id', 'name', 'concrete']);

        return $argument !== null && $this->isServiceReference($argument, $scope) ? [$this->resolutionError($node)] : [];
    }

    /**
     * @param list<Node\Param> $parameters
     * @return list<RuleError>
     */
    private function checkParameters(array $parameters, Scope $scope): array
    {
        $errors = [];

        foreach ($parameters as $parameter) {
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
                } elseif ($type instanceof Name && $this->isServiceType($scope->resolveTypeByName($type))) {
                    $errors[] = RuleErrorBuilder::message('Inject service parameter $'.$parameter->var->name.' through the class constructor instead of a method or function.')
                        ->identifier('workspace.service.requireConstructorServiceInjection')
                        ->line($parameter->getStartLine())
                        ->build();

                    break;
                }
            }
        }

        return $errors;
    }

    /**
     * @param list<Arg> $arguments
     * @param list<string> $names
     */
    private function serviceArgument(array $arguments, array $names): ?Expr
    {
        foreach ($arguments as $position => $argument) {
            if ($argument->unpack) {
                return null;
            }

            if (($argument->name === null && $position === 0) || ($argument->name !== null && in_array($argument->name->toString(), $names, true))) {
                return $argument->value;
            }
        }

        return null;
    }

    private function isServiceReference(Expr $expression, Scope $scope): bool
    {
        if ($expression instanceof ClassConstFetch && $expression->name instanceof Identifier && strtolower($expression->name->toString()) === 'class' && $expression->class instanceof Name && $this->isServiceType($scope->resolveTypeByName($expression->class))) {
            return true;
        }

        $type = $scope->getType($expression);

        foreach ($type->getConstantStrings() as $name) {
            if ($this->isServiceName($name->getValue())) {
                return true;
            }
        }

        return $this->isServiceType($type->getObjectTypeOrClassStringObjectType());
    }

    private function isServiceType(Type $type): bool
    {
        foreach ($type->getObjectClassNames() as $name) {
            if ($this->isServiceName($name)) {
                return true;
            }
        }

        foreach ($type->getObjectClassReflections() as $class) {
            foreach ($class->getAncestors() as $ancestor) {
                if ($this->isServiceName($ancestor->getName())) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isServiceName(string $name): bool
    {
        return str_starts_with(strtolower(ltrim($name, '\\')), 'app\\services\\');
    }

    private function resolutionError(Node $node): RuleError
    {
        return RuleErrorBuilder::message('Inject services through the class constructor instead of creating or resolving them in application code.')
            ->identifier('workspace.service.requireConstructorServiceInjection')
            ->line($node->getStartLine())
            ->build();
    }
}
