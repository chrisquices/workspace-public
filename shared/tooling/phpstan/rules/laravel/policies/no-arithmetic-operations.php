<?php

namespace Workspace\PHPStan\Policies;

use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<Node> */
class NoArithmeticOperations implements Rule
{
    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        $namespace = $scope->getNamespace() ?? '';

        if ($namespace !== 'App\\Policies' && ! str_starts_with($namespace, 'App\\Policies\\')) {
            return [];
        }

        if ($node instanceof Node\Expr\UnaryMinus || $node instanceof Node\Expr\UnaryPlus) {
            // A sign on a numeric literal is fixed data, not a calculation.
            if ($node->expr instanceof Node\Scalar\Int_ || $node->expr instanceof Node\Scalar\Float_) {
                return [];
            }
        } elseif ($node instanceof Node\Expr\BinaryOp\Plus) {
            // Only exempt array union when both operands are definitely arrays.
            if ($scope->getType($node->left)->isArray()->yes() && $scope->getType($node->right)->isArray()->yes()) {
                return [];
            }
        } elseif ($node instanceof Node\Expr\AssignOp\Plus) {
            if ($scope->getType($node->var)->isArray()->yes() && $scope->getType($node->expr)->isArray()->yes()) {
                return [];
            }
        } elseif (! $node instanceof Node\Expr\BinaryOp\Minus
            && ! $node instanceof Node\Expr\BinaryOp\Mul
            && ! $node instanceof Node\Expr\BinaryOp\Div
            && ! $node instanceof Node\Expr\BinaryOp\Mod
            && ! $node instanceof Node\Expr\BinaryOp\Pow
            && ! $node instanceof Node\Expr\AssignOp\Minus
            && ! $node instanceof Node\Expr\AssignOp\Mul
            && ! $node instanceof Node\Expr\AssignOp\Div
            && ! $node instanceof Node\Expr\AssignOp\Mod
            && ! $node instanceof Node\Expr\AssignOp\Pow
            && ! $node instanceof Node\Expr\PreInc
            && ! $node instanceof Node\Expr\PostInc
            && ! $node instanceof Node\Expr\PreDec
            && ! $node instanceof Node\Expr\PostDec) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Policies must delegate arithmetic operations. Move this calculation into a service or helper.')
                ->identifier('workspace.policy.noArithmeticOperations')
                ->line($node->getStartLine())
                ->build(),
        ];
    }
}
