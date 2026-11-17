<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Contracts\Validation\Factory as ValidationFactory;
use Illuminate\Contracts\Validation\ValidatesWhenResolved;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Request as RequestFacade;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Validation\Validator;
use PhpParser\Node;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\New_;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
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

/** @implements Rule<Node> */
class NoRequestValidation implements Rule
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

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller') && ! $controller->is(Controller::class))) {
            return [];
        }

        if (! $node instanceof FuncCall && ! $node instanceof New_ && ! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall) {
            return [];
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->isFirstClassCallable()) {
            return [];
        }

        if ($node instanceof FuncCall) {
            $validatesRequest = $node->name instanceof Name
                && strtolower($this->reflectionProvider->resolveFunctionName($node->name, $scope) ?? '') === 'validator';
        } elseif ($node instanceof New_) {
            $validatesRequest = (new ObjectType(Validator::class))->isSuperTypeOf($scope->getType($node))->yes();
        } else {
            if (! $node->name instanceof Identifier) {
                return [];
            }

            $receiver = $node instanceof StaticCall ? $node->class : $node->var;
            $receiverType = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

            if ($node instanceof StaticCall) {
                $receiverType = $receiverType->getObjectTypeOrClassStringObjectType();
            }

            $receiverType = TypeCombinator::removeNull($receiverType);
            $methodName = strtolower($node->name->toString());
            $validationClasses = match ($methodName) {
                'make' => [ValidationFactory::class, ValidatorFacade::class],
                'validate' => [Request::class, RequestFacade::class, ValidationFactory::class, ValidatorFacade::class, ValidatorContract::class],
                'validatewithbag' => [Request::class, RequestFacade::class, ValidatorContract::class],
                'validateresolved' => [ValidatesWhenResolved::class],
                'passes', 'fails', 'whenpasses', 'whenfails' => [ValidatorContract::class],
                // Raw validators can execute validation lazily through these methods.
                // FormRequest::validated()/safe() only expose the resolved request's input.
                'validated', 'safe', 'valid', 'invalid', 'messages', 'errors', 'getmessagebag', 'addfailure' => [ValidatorContract::class],
                default => [],
            };
            $validatesRequest = $validationClasses !== []
                && TypeCombinator::union(...array_map(static function (string $class): ObjectType {
                        return new ObjectType($class);
                    }, $validationClasses))
                    ->isSuperTypeOf($receiverType)->yes();

            if (! $validatesRequest) {
                $validatesRequest = $this->isRequestValidationTraitMethod($receiverType, $methodName);
            }
        }

        if (! $validatesRequest) {
            return [];
        }

        return [
            RuleErrorBuilder::message("Move request validation into the action's Form Request and read validated input in the controller with validated() or safe().")
                ->identifier('workspace.controller.noRequestValidation')
                ->build(),
        ];
    }

    private function isRequestValidationTraitMethod(Type $receiverType, string $methodName): bool
    {
        $classes = $receiverType->getObjectClassReflections();

        if ($classes === [] || ! $this->reflectionProvider->hasClass(ValidatesRequests::class)) {
            return false;
        }

        $trait = $this->reflectionProvider->getClass(ValidatesRequests::class)->getNativeReflection();

        foreach ($classes as $class) {
            if (! $class->hasTraitUse(ValidatesRequests::class)) {
                return false;
            }

            $reflection = $class->getNativeReflection();

            if (! $reflection->hasMethod($methodName)) {
                return false;
            }

            $method = $reflection->getMethod($methodName);
            $matchesTraitMethod = false;

            // Compare implementations to include renamed trait aliases while excluding
            // controller overrides that merely reuse a validation method's name.
            foreach (['validate', 'validateWith', 'validateWithBag'] as $validationMethodName) {
                $validationMethod = $trait->getMethod($validationMethodName);

                if ($method->getFileName() === $validationMethod->getFileName() && $method->getStartLine() === $validationMethod->getStartLine()) {
                    $matchesTraitMethod = true;

                    break;
                }
            }

            if (! $matchesTraitMethod) {
                return false;
            }
        }

        return true;
    }
}
