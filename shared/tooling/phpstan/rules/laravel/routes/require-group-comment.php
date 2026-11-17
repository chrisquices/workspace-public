<?php

namespace Workspace\PHPStan\Routes;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\FunctionLike;
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
class RequireGroupComment implements Rule
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

        return $this->enforceGroupComment($group);
    }

    /**
     * @param Group $group
     * @return list<RuleError>
     */
    private function enforceGroupComment(array $group): array
    {
        $attributes = $group['attributes']['values'];

        if (! isset($attributes['prefix']) && ! isset($attributes['middleware'])) {
            return [];
        }

        $declaration = $group['call'];
        $comments = $declaration->getComments();

        while (! $declaration instanceof Node\Stmt && ($parent = $this->fileNodes->parent($declaration)) !== null) {

            if ($parent instanceof FunctionLike || $parent instanceof Arg || $parent === $this->fileNodes->fileNode()) {
                break;
            }

            $declaration = $parent;
            array_push($comments, ...$declaration->getComments());
        }

        foreach ($comments as $comment) {
            if ($comment->getEndLine() < $declaration->getStartLine()) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message('Every middleware or prefix group must have a leading comment above its declaration.')
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($group['call']->getStartLine())
                ->build(),
        ];
    }
}
