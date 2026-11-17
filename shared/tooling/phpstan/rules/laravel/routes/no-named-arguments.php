<?php

namespace Workspace\PHPStan\Routes;

use Illuminate\Routing\PendingResourceRegistration;
use Illuminate\Routing\PendingSingletonResourceRegistration;
use Illuminate\Routing\Route;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Name;
use PHPStan\Analyser\Scope;
use PHPStan\Node\FileNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/**
 * @implements Rule<Node>
 * @phpstan-type RouteCall StaticCall|MethodCall|NullsafeMethodCall
 */
class NoNamedArguments implements Rule
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

        if (! $this->isCall($node) || $node->isFirstClassCallable()) {
            return [];
        }

        return $this->noNamedArguments($node, $scope);
    }

    /**
     * @param  RouteCall  $call
     * @return list<RuleError>
     */
    private function noNamedArguments(Expr $call, Scope $scope): array
    {
        $errors = [];

        foreach ($call->getArgs() as $argument) {
            if ($argument->name !== null) {
                $errors[] = RuleErrorBuilder::message(sprintf('Route declarations must use positional arguments. Remove the "%s:" label and pass the value in the declared parameter order.', $argument->name->toString()))
                    ->identifier('workspace.route.'.__FUNCTION__)
                    ->line($argument->getStartLine())
                    ->build();
            }
        }

        if ($errors === [] || $this->receiverKind($call, $scope) !== null) {
            return $errors;
        }

        // Endpoint modifiers operate on Route or pending resource objects,
        // whereas group declarations operate on Router or RouteRegistrar.
        $receiver = $call instanceof StaticCall ? $call->class : $call->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

        if ($call instanceof StaticCall) {
            $type = $type->getObjectTypeOrClassStringObjectType();
        }

        $routingType = TypeCombinator::union(new ObjectType(Route::class), new ObjectType(PendingResourceRegistration::class), new ObjectType(PendingSingletonResourceRegistration::class));

        return $routingType->isSuperTypeOf(TypeCombinator::removeNull($type))->yes() ? $errors : [];
    }
}
