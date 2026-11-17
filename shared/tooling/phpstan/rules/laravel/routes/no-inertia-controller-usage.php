<?php

namespace Workspace\PHPStan\Routes;

use Inertia\Controller as InertiaController;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\ClassConstFetch;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\FunctionLike;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Node\FileNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;

/** @implements Rule<Node> */
class NoInertiaControllerUsage implements Rule
{
    use RouteAnalysis;

    /** @var \WeakMap<Node, bool>|null */
    private ?\WeakMap $processed = null;

    private ?FileNode $fileNode = null;

    public function __construct(private readonly FileNodeIndex $fileNodes) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ($this->fileNode !== $this->fileNodes->fileNode()) {
            $this->fileNode = $this->fileNodes->fileNode();
            $this->processed = new \WeakMap;
        }

        if (! $this->fileNodes->contains($node, $scope->getFile())
            || $this->processed === null || isset($this->processed[$node])) {
            return [];
        }

        $this->processed[$node] = true;

        return $this->noInertiaControllerUsage($node, $scope);
    }

    /** @return list<RuleError> */
    private function noInertiaControllerUsage(Node $node, Scope $scope): array
    {
        $references = [];
        $classNames = [];
        $receiverType = null;

        if ($node instanceof Node\Stmt\Use_ || $node instanceof Node\Stmt\GroupUse) {
            foreach ($node->uses as $use) {
                $importType = $use->type === Node\Stmt\Use_::TYPE_UNKNOWN ? $node->type : $use->type;

                if ($importType === Node\Stmt\Use_::TYPE_NORMAL) {
                    $classNames[] = ($node instanceof Node\Stmt\GroupUse ? $node->prefix->toString().'\\' : '').$use->name->toString();
                }
            }
        } elseif ($node instanceof FunctionLike) {
            foreach ($node->getParams() as $parameter) {
                $references[] = $parameter->type;
            }

            $references[] = $node->getReturnType();
        } elseif ($node instanceof Node\Stmt\Property || $node instanceof Node\Stmt\ClassConst) {
            $references[] = $node->type;
        } elseif ($node instanceof Node\Stmt\Class_) {
            $references = [$node->extends, ...$node->implements];
        } elseif ($node instanceof Node\Stmt\Catch_) {
            $references = $node->types;
        } elseif ($node instanceof Node\Attribute) {
            $references[] = $node->name;
        } elseif ($node instanceof StaticCall || $node instanceof Expr\StaticPropertyFetch
            || $node instanceof ClassConstFetch || $node instanceof Expr\New_ || $node instanceof Expr\Instanceof_) {
            if ($node->class instanceof Name) {
                $references[] = $node->class;
            } elseif ($node->class instanceof Expr) {
                $receiverType = $scope->getType($node->class)->getObjectTypeOrClassStringObjectType();
            } elseif ($node instanceof Expr\New_) {
                $receiverType = $scope->getType($node);
            }
        } elseif ($node instanceof MethodCall || $node instanceof NullsafeMethodCall
            || $node instanceof Expr\PropertyFetch || $node instanceof Expr\NullsafePropertyFetch
            || $node instanceof Expr\ArrayDimFetch) {
            $receiverType = $scope->getType($node->var);
        } elseif ($node instanceof Expr\Clone_) {
            $receiverType = $scope->getType($node->expr);
        } elseif ($node instanceof String_) {
            // Laravel also accepts fully qualified class strings and Class@method actions.
            $className = explode('@', ltrim($node->value, '\\'), 2)[0];

            if (strcasecmp($className, InertiaController::class) === 0) {
                $classNames[] = $className;
            }
        }

        // Native type names are not all visited individually by PHPStan.
        while ($references !== []) {
            $reference = array_pop($references);

            if ($reference instanceof Node\NullableType) {
                $references[] = $reference->type;
            } elseif ($reference instanceof Node\UnionType || $reference instanceof Node\IntersectionType) {
                array_push($references, ...$reference->types);
            } elseif ($reference instanceof Name) {
                array_push($classNames, ...$scope->resolveTypeByName($reference)->getObjectClassNames());
            }
        }

        if ($receiverType !== null) {
            array_push($classNames, ...$receiverType->getObjectClassNames());
        }

        // The inertia() route shortcut registers Inertia\Controller internally.
        $usesInertiaController = $this->isCall($node)
            && $this->methodName($node, $scope) === 'inertia'
            && $this->receiverKind($node, $scope) !== null;

        foreach ($classNames as $className) {
            if (strcasecmp($className, InertiaController::class) === 0
                || (new ObjectType(InertiaController::class))->isSuperTypeOf(new ObjectType($className))->yes()) {
                $usesInertiaController = true;

                break;
            }
        }

        if (! $usesInertiaController) {
            return [];
        }

        return [
            RuleErrorBuilder::message("InertiaController (Inertia\\Controller) must not be used in route files. Use an explicit method on a controller for the route group's model, module, or domain.")
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
