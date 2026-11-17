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
 *
 * @phpstan-type RouteCall StaticCall|MethodCall|NullsafeMethodCall
 * @phpstan-type Attributes array{values: array<string, Type>, unknown: bool}
 * @phpstan-type Group array{call: RouteCall, attributes: Attributes, callback: Expr|null}
 */
class RequireMatchingPrefixAndName implements Rule
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

        if ($method !== 'group') {
            return [];
        }

        $group = $this->describeGroup($node, $scope);

        return $this->enforcePrefixNameMatch($group);
    }

    /**
     * @param  Group  $group
     * @return list<RuleError>
     */
    private function enforcePrefixNameMatch(array $group): array
    {
        $attributes = $group['attributes'];
        $prefix = $attributes['values']['prefix'] ?? null;
        $name = $attributes['values']['as'] ?? null;

        if ($prefix !== null && $name === null) {

            // Missing names belong exclusively to enforceGroupName().
            return [];
        }

        if ($prefix === null) {
            if ($attributes['unknown']) {
                return [
                    RuleErrorBuilder::message('Cannot determine the local prefix/name attributes of this group. Declare them explicitly with statically determinable values.')
                        ->identifier('workspace.route.'.__FUNCTION__)
                        ->line($group['call']->getStartLine())
                        ->build(),
                ];
            }

            return [];
        }

        if (! (count($prefix->getConstantStrings()) === 1 && $prefix->isConstantScalarValue()->yes()) || ! (count($name->getConstantStrings()) === 1 && $name->isConstantScalarValue()->yes())) {
            return [
                RuleErrorBuilder::message('Cannot determine whether this group name matches its local prefix. Use statically determinable string values.')
                    ->identifier('workspace.route.'.__FUNCTION__)
                    ->line($group['call']->getStartLine())
                    ->build(),
            ];
        }

        $expected = $prefix->getConstantStrings()[0]->getValue() === '' ? '' : $prefix->getConstantStrings()[0]->getValue().'.';

        if ($name->getConstantStrings()[0]->getValue() === $expected) {
            return [];
        }

        return [
            RuleErrorBuilder::message(sprintf('The group name must be exactly %s for the local prefix %s.', var_export($expected, true), var_export($prefix->getConstantStrings()[0]->getValue(), true)))
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($group['call']->getStartLine())
                ->build(),
        ];
    }
}
