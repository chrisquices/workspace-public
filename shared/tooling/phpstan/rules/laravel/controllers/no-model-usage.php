<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use PhpParser\Node;
use PhpParser\NodeFinder;
use PhpParser\Node\Expr\ArrayDimFetch;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\Clone_;
use PhpParser\Node\Expr\Instanceof_;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\New_;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\NullsafePropertyFetch;
use PhpParser\Node\Expr\PropertyFetch;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\StaticPropertyFetch;
use PhpParser\Node\FunctionLike;
use PhpParser\Node\IntersectionType;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\Stmt\GroupUse;
use PhpParser\Node\Stmt\Use_;
use PhpParser\Node\UnionType;
use PHPStan\Analyser\Scope;
use PHPStan\Parser\Parser;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\Type;

/** @implements Rule<Node> */
class NoModelUsage implements Rule
{
    public function __construct(private readonly Parser $parser) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        // Imports are visited outside the class scope.
        if ($node instanceof Use_ || $node instanceof GroupUse) {
            if (! $this->isControllerFile($scope)) {
                return [];
            }
        } else {
            $controller = $scope->getClassReflection();

            if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller') && ! $controller->is(Controller::class))) {
                return [];
            }
        }

        if ($node->getAttribute('virtualNullsafeMethodCall', false) || $node->getAttribute('virtualNullsafePropertyFetch', false)) {
            return [];
        }

        $references = [];
        $receiverType = null;

        if ($node instanceof Use_ || $node instanceof GroupUse) {
            foreach ($node->uses as $use) {
                $importType = $use->type === Use_::TYPE_UNKNOWN ? $node->type : $use->type;

                if ($importType !== Use_::TYPE_NORMAL) {
                    continue;
                }

                $className = ($node instanceof GroupUse ? $node->prefix->toString().'\\' : '').$use->name->toString();
                $references[] = new Name\FullyQualified($className, $use->name->getAttributes());
            }
        } elseif ($node instanceof FunctionLike) {
            // Inspect native declarations on their parent node: individual name
            // components of nullable, union, and intersection types may not be visited.
            foreach ($node->getParams() as $parameter) {
                $references[] = $parameter->type;
            }

            $references[] = $node->getReturnType();
        } elseif ($node instanceof Node\Stmt\Property || $node instanceof Node\Stmt\ClassConst) {
            $references[] = $node->type;
        } elseif ($node instanceof Node\Stmt\Catch_) {
            $references = $node->types;
        } elseif ($node instanceof Node\Attribute) {
            $references[] = $node->name;
        } elseif ($node instanceof StaticCall || $node instanceof StaticPropertyFetch || $node instanceof ClassConstFetch || $node instanceof New_ || $node instanceof Instanceof_) {
            if ($node->class instanceof Name) {
                $references[] = $node->class;
            } elseif ($node->class instanceof Node\Expr) {
                $receiverType = $scope->getType($node->class)->getObjectTypeOrClassStringObjectType();
            } elseif ($node instanceof New_) {
                // Anonymous models have a class declaration in place of a name.
                $receiverType = $scope->getType($node);
            }
        } elseif ($node instanceof MethodCall || $node instanceof NullsafeMethodCall || $node instanceof PropertyFetch || $node instanceof NullsafePropertyFetch || $node instanceof ArrayDimFetch) {
            $receiverType = $scope->getType($node->var);
        } elseif ($node instanceof Clone_) {
            $receiverType = $scope->getType($node->expr);
        }

        $errors = [];

        while ($references !== []) {
            $reference = array_pop($references);

            if ($reference instanceof NullableType) {
                $references[] = $reference->type;
            } elseif ($reference instanceof UnionType || $reference instanceof IntersectionType) {
                array_push($references, ...$reference->types);
            } elseif ($reference instanceof Name && $this->isModelType($scope->resolveTypeByName($reference))
                && ! $this->isAuthorizationReference($node, $reference, $scope)) {
                $errors[] = $this->modelUsageError($reference);
            }
        }

        // Inspect the operation's receiver, never the inferred type of a local
        // variable, argument, or return value being passed along.
        if ($receiverType !== null && $this->isModelType($receiverType)) {
            $errors[] = $this->modelUsageError($node);
        }

        return $errors;
    }

    private function isAuthorizationReference(Node $node, Name $reference, Scope $scope): bool
    {
        if (! $node instanceof ClassConstFetch && ! $node instanceof Use_ && ! $node instanceof GroupUse) {
            return false;
        }

        $targetClasses = $scope->resolveTypeByName($reference)->getObjectClassNames();
        $calls = (new NodeFinder)->findInstanceOf($this->parser->parseFile($scope->getFile()), StaticCall::class);

        foreach ($calls as $call) {
            if (! $call->class instanceof Name || ! $call->name instanceof Node\Identifier
                || strtolower($call->name->toString()) !== 'authorize') {
                continue;
            }

            $gate = false;
            foreach ($scope->resolveTypeByName($call->class)->getObjectClassReflections() as $class) {
                if ($class->is(Gate::class)) {
                    $gate = true;
                    break;
                }
            }

            if (! $gate) {
                continue;
            }

            foreach ($call->getArgs() as $position => $argument) {
                if (($argument->name?->toString() ?? ($position === 1 ? 'arguments' : '')) !== 'arguments'
                    || ! $argument->value instanceof ClassConstFetch
                    || ! $argument->value->name instanceof Node\Identifier
                    || strtolower($argument->value->name->toString()) !== 'class'
                    || ! $argument->value->class instanceof Name) {
                    continue;
                }

                if ($node instanceof ClassConstFetch && $node->getStartFilePos() === $argument->value->getStartFilePos()) {
                    return true;
                }

                if (($node instanceof Use_ || $node instanceof GroupUse)
                    && array_intersect($targetClasses, $scope->resolveTypeByName($argument->value->class)->getObjectClassNames()) !== []) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isControllerFile(Scope $scope): bool
    {
        $namespace = $scope->getNamespace() ?? '';
        $file = str_replace('\\', '/', $scope->getFile());

        return $namespace === 'App\\Http\\Controllers'
            || str_starts_with($namespace, 'App\\Http\\Controllers\\')
            || str_contains($file, '/app/Http/Controllers/');
    }

    private function isModelType(Type $type): bool
    {
        foreach ($type->getObjectClassReflections() as $class) {
            if ($class->is(Model::class)) {
                return true;
            }
        }

        return false;
    }

    private function modelUsageError(Node $node): RuleError
    {
        return RuleErrorBuilder::message('Controllers must obtain models or data through services and only pass them along. Move this model reference or operation into a service.')
            ->identifier('workspace.controller.noModelUsage')
            ->line($node->getStartLine())
            ->build();
    }
}
