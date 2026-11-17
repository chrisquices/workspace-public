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
use PHPStan\Type\Constant\ConstantStringType;
use PHPStan\Type\MixedType;

/**
 * @implements Rule<Node>
 * @phpstan-type RouteCall StaticCall|MethodCall|NullsafeMethodCall
 */
class RequireRouteName implements Rule
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

        return $this->enforceRouteName($node, $scope);
    }

    /**
     * @param RouteCall $call
     * @return list<RuleError>
     */
    private function enforceRouteName(Expr $call, Scope $scope): array
    {
        $name = $this->fluentAttributes($call, $scope)['values']['as'] ?? null;
        $cursor = $call;

        // Inspect only the receiver spine of this registration's chain. Names
        // inside arguments, callbacks or another route can never satisfy it.
        while (($parent = $this->fileNodes->parent($cursor)) !== null) {
            
            if ((! $parent instanceof MethodCall && ! $parent instanceof NullsafeMethodCall)
                || $parent->var !== $cursor || $parent->isFirstClassCallable()) {
                break;
            }

            $method = $this->methodName($parent, $scope);

            if (! in_array($method, [
                'name', 'middleware', 'withoutmiddleware', 'prefix', 'domain', 'where', 'wherenumber',
                'wherealpha', 'wherealphanumeric', 'whereuuid', 'whereulid', 'wherein', 'setwheres',
                'defaults', 'setdefaults', 'fallback', 'setfallback', 'withtrashed', 'scopebindings',
                'withoutscopedbindings', 'can', 'missing', 'block', 'withoutblocking', 'metadata',
                'setmetadata', 'seturi', 'setbindingfields', 'setrouter', 'setcontainer',
            ], true)) {
                // A different object cannot lend its name to this route.
                break;
            }

            if ($method === 'name') {
                $expression = $this->argument($parent, 0, ['name']);
                $part = $expression !== null ? $scope->getType($expression) : new MixedType;

                // Route::name appends; a later empty suffix does not erase a
                // previously explicit nonempty name (registrars overwrite).
                if (($name !== null && count($name->getConstantStrings()) === 1 && $name->isConstantScalarValue()->yes()) && (count($part->getConstantStrings()) === 1 && $part->isConstantScalarValue()->yes())) {
                    $name = new ConstantStringType($name->getConstantStrings()[0]->getValue() . $part->getConstantStrings()[0]->getValue());
                } elseif ($name === null || ! $name->isNonEmptyString()->yes()) {
                    $name = $part;
                }
            }

            $cursor = $parent;
        }

        if ($name !== null && $name->isNonEmptyString()->yes()) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Every HTTP endpoint must explicitly declare a statically provable nonempty route name in its registration chain. An inherited group name is insufficient.')
                ->identifier('workspace.route.'.__FUNCTION__)
                ->line($call->getStartLine())
                ->build(),
        ];
    }
}
