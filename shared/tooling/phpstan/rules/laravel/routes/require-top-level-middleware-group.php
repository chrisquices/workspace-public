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
class RequireTopLevelMiddlewareGroup implements Rule
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

        if ($method !== 'group' && ! in_array($method, self::ENDPOINTS, true)) {
            return [];
        }

        if ($this->receiverKind($node, $scope) === null) {
            return [];
        }

        $groups = $this->enclosingGroups($node, $scope);
        $group = $method === 'group' ? $this->describeGroup($node, $scope) : null;

        return $this->enforceTopLevelMiddlewareGroup($node, $group, $groups);
    }

    /**
     * @param RouteCall $call
     * @param Group|null $group
     * @param list<Group> $groups
     * @return list<RuleError>
     */
    private function enforceTopLevelMiddlewareGroup(Expr $call, ?array $group, array $groups): array
    {
        if ($groups !== [] || ($group !== null && isset($group['attributes']['values']['middleware']))) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Outermost route declarations must be middleware groups. Place endpoint registrations in prefix groups inside a middleware group.')
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($call->getStartLine())
                ->build(),
        ];
    }
}
