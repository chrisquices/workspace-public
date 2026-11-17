<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\Expr\ArrayDimFetch;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\NullsafePropertyFetch;
use PhpParser\Node\Expr\PropertyFetch;
use PhpParser\Node\Identifier;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class NoUnvalidatedFormRequestInput implements Rule
{
    private const INPUT_METHODS = [
        'all', 'allfiles', 'anyfilled', 'array', 'boolean', 'clamp', 'collect',
        'date', 'enum', 'enums', 'except', 'exists', 'file', 'filled', 'float',
        'fluent', 'get', 'getcontent', 'getpayload', 'has', 'hasany', 'hasfile',
        'image', 'input', 'integer', 'interval', 'isnotfilled', 'json', 'keys',
        'missing', 'offsetexists', 'offsetget', 'only', 'post', 'query', 'str',
        'string', 'toarray', 'whenenum', 'whenfilled', 'whenhas', 'whenmissing', '__get',
    ];

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ((! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall
            && ! $node instanceof PropertyFetch && ! $node instanceof NullsafePropertyFetch
            && ! $node instanceof ArrayDimFetch)
            || $node->getAttribute('virtualNullsafeMethodCall', false)
            || $node->getAttribute('virtualNullsafePropertyFetch', false)) {
            return [];
        }

        $controller = $scope->getClassReflection();
        $namespace = $scope->getNamespace() ?? '';

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller')
            && ! $controller->is(Controller::class)
            && $namespace !== 'App\\Http\\Controllers'
            && ! str_starts_with($namespace, 'App\\Http\\Controllers\\'))) {
            return [];
        }

        $receiver = TypeCombinator::removeNull($scope->getType($node->var));

        if (! (new ObjectType(FormRequest::class))->isSuperTypeOf($receiver)->yes()) {
            return [];
        }

        if ($node instanceof MethodCall || $node instanceof NullsafeMethodCall) {
            if (! $node->name instanceof Identifier && ! $node->name instanceof String_) {
                return [];
            }

            $method = $node->name instanceof Identifier ? $node->name->toString() : $node->name->value;

            if (! in_array(strtolower($method), self::INPUT_METHODS, true)) {
                return [];
            }
        } elseif ($node instanceof PropertyFetch || $node instanceof NullsafePropertyFetch) {
            if (! $node->name instanceof Identifier && ! $node->name instanceof String_) {
                return [];
            }

            $property = $node->name instanceof Identifier ? $node->name->toString() : $node->name->value;

            if (! $this->isInputProperty($receiver, $property)) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message('Controllers must not access unvalidated Form Request input. Read validated input with validated() or safe() instead.')
                ->identifier('workspace.controller.noUnvalidatedFormRequestInput')
                ->line($node->getStartLine())
                ->build(),
        ];
    }

    private function isInputProperty(Type $receiver, string $property): bool
    {
        if (in_array($property, ['request', 'query', 'files'], true)) {
            return true;
        }

        foreach ($receiver->getObjectClassReflections() as $class) {
            $reflection = $class->getNativeReflection();

            if ($reflection->hasProperty($property) && $reflection->getProperty($property)->isPublic()) {
                return false;
            }
        }

        // Laravel treats undeclared properties as input lookups through __get().
        return true;
    }
}
