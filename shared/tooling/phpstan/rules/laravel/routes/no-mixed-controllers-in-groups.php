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
use PHPStan\Type\Type;

/**
 * @implements Rule<Node>
 * @phpstan-type RouteCall StaticCall|MethodCall|NullsafeMethodCall
 * @phpstan-type Attributes array{values: array<string, Type>, unknown: bool}
 * @phpstan-type Group array{call: RouteCall, attributes: Attributes, callback: Expr|null}
 */
class NoMixedControllersInGroups implements Rule
{
    use RouteAnalysis;

    /** @var \WeakMap<Node, bool>|null */
    private ?\WeakMap $processed = null;

    /** @var \WeakMap<Node, array{controller: string, reported: bool}>|null */
    private ?\WeakMap $groupControllers = null;

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
            $this->groupControllers = new \WeakMap;
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

        if ($method !== 'group' && ! in_array($method, self::ENDPOINTS, true)) {
            return [];
        }

        if ($this->receiverKind($node, $scope) === null) {
            return [];
        }

        if ($method === 'group') {
            return [];
        }

        $groups = $this->enclosingGroups($node, $scope);

        return $this->noMixedControllersInGroups($node, $scope, $groups);
    }

    /**
     * @param RouteCall $call
     * @param list<Group> $groups
     * @return list<RuleError>
     */
    private function noMixedControllersInGroups(Expr $call, Scope $scope, array $groups): array
    {
        if ($groups === [] || $this->groupControllers === null) {
            return [];
        }

        $controller = $this->controllerAction($call, $scope);

        // Invalid actions already belong to enforceControllerAction().
        if ($controller === null) {
            return [];
        }

        $class = $scope->resolveName($controller);

        // Only the nearest group owns this route. Nested groups are independent.
        $group = $groups[0]['call'];
        $previous = $this->groupControllers[$group] ?? null;

        if ($previous === null) {
            $this->groupControllers[$group] = ['controller' => $class, 'reported' => false];

            return [];
        }

        if ($previous['reported'] || strcasecmp($previous['controller'], $class) === 0) {
            return [];
        }

        $this->groupControllers[$group] = ['controller' => $previous['controller'], 'reported' => true];

        return [
            RuleErrorBuilder::message(sprintf('This route group uses multiple controllers: %s, %s. Use one controller per group. Split these routes into separate groups with their own prefixes and names, each related to a model, module, or domain.', $previous['controller'], $class))
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($group->getStartLine())
                ->build(),
        ];
    }
}
