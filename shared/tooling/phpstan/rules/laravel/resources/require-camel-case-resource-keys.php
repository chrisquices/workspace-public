<?php

namespace Workspace\PHPStan\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use PhpParser\Node;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\ArrowFunction;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\BinaryOp\Coalesce;
use PhpParser\Node\Expr\Closure;
use PhpParser\Node\Expr\Match_;
use PhpParser\Node\Expr\Ternary;
use PhpParser\Node\Expr\Variable;
use PhpParser\Node\Scalar\String_;
use PhpParser\Node\Stmt\ClassLike;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Stmt\Function_;
use PhpParser\Node\Stmt\Return_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<ClassMethod> */
class RequireCamelCaseResourceKeys implements Rule
{
    public function getNodeType(): string
    {
        return ClassMethod::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $class = $scope->getClassReflection();

        if ($class === null || ! $class->isSubclassOf(JsonResource::class) || strtolower($node->name->toString()) !== 'toarray' || $node->stmts === null) {
            return [];
        }

        $assignments = [];
        $visited = [];
        $errors = [];

        foreach ($node->stmts as $statement) {
            $this->collectAssignments($statement, $assignments);
        }

        foreach ($node->stmts as $statement) {
            array_push($errors, ...$this->findReturnedKeys($statement, $assignments, $visited));
        }

        return $errors;
    }

    /** @param array<string, list<Node>> $assignments */
    private function collectAssignments(Node $node, array &$assignments): void
    {
        if ($node instanceof ClassLike || $node instanceof Function_ || $node instanceof Closure || $node instanceof ArrowFunction) {
            return;
        }

        if ($node instanceof Assign && $node->var instanceof Variable && is_string($node->var->name)) {
            $assignments[$node->var->name][] = $node->expr;
        }

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;
            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node) {
                    $this->collectAssignments($child, $assignments);
                }
            }
        }
    }

    /**
     * @param array<string, list<Node>> $assignments
     * @param array<string, bool> $visited
     * @return list<RuleError>
     */
    private function findReturnedKeys(Node $node, array $assignments, array &$visited): array
    {
        if ($node instanceof ClassLike || $node instanceof Function_ || $node instanceof Closure || $node instanceof ArrowFunction) {
            return [];
        }

        if ($node instanceof Return_) {
            return $node->expr === null ? [] : $this->checkReturnedValue($node->expr, $assignments, $visited);
        }

        $errors = [];

        foreach ($node->getSubNodeNames() as $name) {
            $children = $node->$name;
            $children = is_array($children) ? $children : [$children];

            foreach ($children as $child) {
                if ($child instanceof Node) {
                    array_push($errors, ...$this->findReturnedKeys($child, $assignments, $visited));
                }
            }
        }

        return $errors;
    }

    /**
     * @param array<string, list<Node>> $assignments
     * @param array<string, bool> $visited
     * @return list<RuleError>
     */
    private function checkReturnedValue(Node $node, array $assignments, array &$visited): array
    {
        $errors = [];

        if ($node instanceof Array_) {
            foreach ($node->items as $item) {
                if ($item === null) {
                    continue;
                }

                if ($item->key instanceof String_ && preg_match('/^[a-z][a-zA-Z0-9]*$/D', $item->key->value) !== 1) {
                    $key = $item->key->value;
                    $literalKey = [$key => true];

                    if (! is_int(array_key_first($literalKey))) {
                        $errors[] = RuleErrorBuilder::message('Resource field "'.$key.'" must use camelCase. Update its consumers when renaming the field.')
                            ->identifier('workspace.resource.requireCamelCaseResourceKeys')
                            ->line($item->key->getStartLine())
                            ->build();
                    }
                }

                array_push($errors, ...$this->checkReturnedValue($item->value, $assignments, $visited));
            }
        } elseif ($node instanceof Ternary) {
            if ($node->if !== null) {
                array_push($errors, ...$this->checkReturnedValue($node->if, $assignments, $visited));
            }

            array_push($errors, ...$this->checkReturnedValue($node->else, $assignments, $visited));
        } elseif ($node instanceof Coalesce) {
            array_push($errors, ...$this->checkReturnedValue($node->left, $assignments, $visited), ...$this->checkReturnedValue($node->right, $assignments, $visited));
        } elseif ($node instanceof Match_) {
            foreach ($node->arms as $arm) {
                array_push($errors, ...$this->checkReturnedValue($arm->body, $assignments, $visited));
            }
        } elseif ($node instanceof Variable && is_string($node->name) && ! isset($visited[$node->name]) && count($assignments[$node->name] ?? []) === 1) {
            $visited[$node->name] = true;
            array_push($errors, ...$this->checkReturnedValue($assignments[$node->name][0], $assignments, $visited));
        }

        return $errors;
    }
}
