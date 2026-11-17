<?php

namespace Workspace\PHPStan\General;

use PhpParser\Node;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\ArrowFunction;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\Closure;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\FunctionLike;
use PhpParser\Node\Name;
use PhpParser\Node\Scalar\String_;
use PhpParser\Node\Stmt\ClassLike;
use PhpParser\Node\Stmt\Return_;
use PhpParser\NodeFinder;
use PHPStan\Analyser\Scope;
use PHPStan\Parser\Parser;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Node> */
class RequireNamedVariablesInReturnedArrays implements Rule
{
    /** @var array<string, array<int, Array_>> */
    private array $returnedArrays = [];

    /** @var array<string, bool> */
    private array $reportedArrays = [];

    public function __construct(private readonly Parser $parser) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof Return_) {
            return [];
        }

        $array = $node->expr instanceof Array_ ? $node->expr : null;
        $indirect = false;
        $arrayId = null;

        if ($node->expr instanceof Variable && is_string($node->expr->name)) {
            $file = $scope->getTraitReflection()?->getFileName() ?: $scope->getFile();

            if (! isset($this->returnedArrays[$file])) {
                $this->returnedArrays[$file] = $this->findReturnedArrays($file);
            }

            $array = $this->returnedArrays[$file][$node->getStartFilePos()] ?? null;
            $indirect = true;
            $arrayId = $array === null ? null : $file.':'.$array->getStartFilePos();

            if ($arrayId !== null && isset($this->reportedArrays[$arrayId])) {
                return [];
            }
        }

        if ($array === null) {
            return [];
        }

        $errors = [];

        foreach ($array->items as $item) {
            if ($item->unpack || $item->key === null) {
                continue;
            }

            $keyType = $scope->getType($item->key);
            $keyName = (! $indirect || $item->key instanceof String_) && count($keyType->getConstantStrings()) === 1 && $keyType->isConstantScalarValue()->yes()
                ? $keyType->getConstantStrings()[0]->getValue()
                : null;
            // Numeric, dynamic, and non-identifier keys still require a variable,
            // but cannot prescribe a matching PHP variable name.
            $variableName = $keyName !== null && preg_match('/^[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*$/D', $keyName) === 1 ? $keyName : null;

            if ($item->value instanceof Node\Expr\Variable
                && is_string($item->value->name)
                && ($variableName === null || $item->value->name === $variableName)) {
                continue;
            }

            $message = $variableName !== null
                ? "Returned array key \"{$keyName}\" must use the matching local variable \${$variableName}. Assign or rename the value to \${$variableName} before returning the array."
                : 'Explicitly keyed values in returned arrays must be plain named variables. Assign this value to a variable before returning the array.';

            $errors[] = RuleErrorBuilder::message($message)
                ->identifier('workspace.general.requireNamedVariablesInReturnedArrays')
                ->line($item->value->getStartLine())
                ->build();
        }

        if ($errors !== [] && $arrayId !== null) {
            $this->reportedArrays[$arrayId] = true;
        }

        return $errors;
    }

    /** @return array<int, Array_> */
    private function findReturnedArrays(string $file): array
    {
        $nodes = $this->parser->parseFile($file);
        $finder = new NodeFinder;
        $arrays = [];
        $this->indexScope($nodes, $finder, $arrays);

        foreach ($finder->findInstanceOf($nodes, FunctionLike::class) as $function) {
            $statements = $function->getStmts();

            if ($function instanceof ArrowFunction || $statements === null) {
                continue;
            }

            $parts = $function->getParams();

            if ($function instanceof Closure) {
                array_push($parts, ...$function->uses);
            }

            array_push($parts, ...$statements);
            $this->indexScope($parts, $finder, $arrays);
        }

        return $arrays;
    }

    /**
     * @param list<Node> $nodes
     * @param array<int, Array_> $arrays
     */
    private function indexScope(array $nodes, NodeFinder $finder, array &$arrays): void
    {
        $dynamic = $finder->findFirst($nodes, function (Node $node): bool {
            return ($node instanceof Variable && (! is_string($node->name) || $node->name === 'GLOBALS'))
                || ($node instanceof FuncCall && $node->name instanceof Name && strtolower($node->name->toString()) === 'extract');
        });

        if ($dynamic !== null) {
            return;
        }

        $assignments = [];
        $returns = [];

        foreach ($nodes as $node) {
            $this->findScopeNodes($node, $assignments, $returns);
        }

        $occurrences = [];

        foreach ($finder->findInstanceOf($nodes, Variable::class) as $variable) {
            if (is_string($variable->name)) {
                $occurrences[$variable->name][] = $variable->getStartFilePos();
            }
        }

        foreach ($assignments as $name => $candidates) {
            if (count($candidates) !== 1 || ! isset($returns[$name], $occurrences[$name])) {
                continue;
            }

            $assignment = $candidates[0];
            $expected = [$assignment->var->getStartFilePos()];

            foreach ($returns[$name] as $return) {
                $expected[] = $return->expr->getStartFilePos();
            }

            $actual = $occurrences[$name];
            sort($expected);
            sort($actual);

            if ($expected !== $actual || in_array(-1, $expected, true)) {
                continue;
            }

            foreach ($returns[$name] as $return) {
                if ($return->getStartFilePos() > $assignment->getStartFilePos()) {
                    $arrays[$return->getStartFilePos()] = $assignment->expr;
                }
            }
        }
    }

    /**
     * @param array<string, list<Assign>> $assignments
     * @param array<string, list<Return_>> $returns
     */
    private function findScopeNodes(Node $node, array &$assignments, array &$returns): void
    {
        if ($node instanceof FunctionLike || $node instanceof ClassLike) {
            return;
        }

        if ($node instanceof Assign && $node->var instanceof Variable && is_string($node->var->name) && $node->expr instanceof Array_) {
            $assignments[$node->var->name][] = $node;
        }

        if ($node instanceof Return_ && $node->expr instanceof Variable && is_string($node->expr->name)) {
            $returns[$node->expr->name][] = $node;
        }

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;
            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node) {
                    $this->findScopeNodes($child, $assignments, $returns);
                }
            }
        }
    }
}
