<?php

namespace Workspace\PHPStan\Routes;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PHPStan\Analyser\Scope;
use PHPStan\Node\FileNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * @implements Rule<Node>
 * @phpstan-type RouteCall StaticCall|MethodCall|NullsafeMethodCall
 */
class RequireControllerAction implements Rule
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

        $method = $this->methodName($node, $scope);

        if ($this->receiverKind($node, $scope) === null
            || ($method !== null && ! in_array($method, self::ENDPOINTS, true))) {
            return [];
        }

        return $this->enforceControllerAction($node, $scope);
    }

    /**
     * @param RouteCall $call
     * @return list<RuleError>
     */
    private function enforceControllerAction(Expr $call, Scope $scope): array
    {
        if ($this->methodName($call, $scope) === null) {
            return [
                RuleErrorBuilder::message('Cannot determine what this dynamic routing call registers. Use a statically determinable routing method so its group and endpoint requirements can be checked.')
                    ->identifier('workspace.route.'.__FUNCTION__)
                    ->line($call->getStartLine())
                    ->build(),
            ];
        }

        if ($this->controllerAction($call, $scope) !== null) {
            return [];
        }

        return [
            RuleErrorBuilder::message("Every HTTP endpoint action must be a literal [SomeController::class, 'methodName'] pair with an explicit class and nonempty method. Replace shorthand and shortcut registrations with explicit controller routes. Every route group must relate to a model, module, or domain and use methods on a controller for that model, module, or domain.")
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($call->getStartLine())
                ->build(),
        ];
    }
}
