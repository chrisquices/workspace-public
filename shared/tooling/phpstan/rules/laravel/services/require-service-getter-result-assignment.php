<?php

namespace Workspace\PHPStan\Services;

use PhpParser\Node;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\AssignRef;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt\Expression;
use PhpParser\NodeFinder;
use PHPStan\Analyser\Scope;
use PHPStan\Parser\Parser;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\Type;
use PHPStan\Type\TypeCombinator;
use PHPStan\Type\UnionType;

/** @implements Rule<Node> */
class RequireServiceGetterResultAssignment implements Rule
{
    /** @var array<string, array<string, true>> */
    private array $assignments = [];

    public function __construct(private readonly Parser $parser) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ((! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall && ! $node instanceof StaticCall)
            || ! $node->name instanceof Identifier
            || $node->getAttribute('virtualNullsafeMethodCall', false)
            || $node->isFirstClassCallable()) {
            return [];
        }

        $method = $node->name->toString();

        if (preg_match('/^get[A-Z]/', $method) !== 1) {
            return [];
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $type = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);
        $type = TypeCombinator::removeNull($node instanceof StaticCall ? $type->getObjectTypeOrClassStringObjectType() : $type);

        if (! $this->isServiceType($type)) {
            return [];
        }

        $file = $scope->getTraitReflection()?->getFileName() ?: $scope->getFile();

        if (! isset($this->assignments[$file])) {
            $this->assignments[$file] = $this->findAssignments($file);
        }

        $position = $node->getStartFilePos().':'.$node->getEndFilePos();

        if (isset($this->assignments[$file][$position])) {
            return [];
        }

        $expected = lcfirst(substr($method, 3)).'Raw';

        return [
            RuleErrorBuilder::message("Assign the result of service getter {$method}() to \${$expected} in a separate statement before using it.")
                ->identifier('workspace.service.requireServiceGetterResultAssignment')
                ->line($node->getStartLine())
                ->build(),
        ];
    }

    /** @return array<string, true> */
    private function findAssignments(string $file): array
    {
        $assignments = [];

        foreach ((new NodeFinder)->findInstanceOf($this->parser->parseFile($file), Expression::class) as $statement) {
            $assignment = $statement->expr;

            if ((! $assignment instanceof Assign && ! $assignment instanceof AssignRef)
                || ! $assignment->var instanceof Variable
                || ! is_string($assignment->var->name)) {
                continue;
            }

            $call = $assignment->expr;

            if ((! $call instanceof MethodCall && ! $call instanceof NullsafeMethodCall && ! $call instanceof StaticCall)
                || $call->getStartFilePos() < 0 || $call->getEndFilePos() < 0) {
                continue;
            }

            $position = $call->getStartFilePos().':'.$call->getEndFilePos();
            $assignments[$position] = true;
        }

        return $assignments;
    }

    private function isServiceType(Type $type): bool
    {
        if ($type instanceof UnionType) {
            foreach ($type->getTypes() as $member) {
                if (! $this->isServiceType($member)) {
                    return false;
                }
            }

            return true;
        }

        foreach ($type->getObjectClassReflections() as $class) {
            if ($this->isServiceName($class->getName())) {
                return true;
            }

            foreach ($class->getAncestors() as $ancestor) {
                if ($this->isServiceName($ancestor->getName())) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isServiceName(string $name): bool
    {
        return str_starts_with(strtolower(ltrim($name, '\\')), 'app\\services\\');
    }
}
