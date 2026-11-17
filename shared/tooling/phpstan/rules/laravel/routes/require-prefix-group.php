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
class RequirePrefixGroup implements Rule
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

        if ($method === 'group') {
            return [];
        }

        $groups = $this->enclosingGroups($node, $scope);

        return $this->enforcePrefix($node, $groups);
    }

    /**
     * @param RouteCall $call
     * @param list<Group> $groups
     * @return list<RuleError>
     */
    private function enforcePrefix(Expr $call, array $groups): array
    {
        foreach ($groups as $group) {
            if (isset($group['attributes']['values']['prefix'])) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message('Every HTTP endpoint must be inside a group with an explicit prefix, including an empty prefix for root URLs. A per-route prefix does not satisfy this requirement.')
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($call->getStartLine())
                ->build(),
        ];
    }
}
