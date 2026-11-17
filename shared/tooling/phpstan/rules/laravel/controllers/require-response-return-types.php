<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use PhpParser\Node;
use PhpParser\Node\FunctionLike;
use PHPStan\Analyser\Scope;
use PHPStan\Node\MethodReturnStatementsNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;
use PHPStan\Type\VerbosityLevel;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** @implements Rule<MethodReturnStatementsNode> */
class RequireResponseReturnTypes implements Rule
{
    public function getNodeType(): string
    {
        return MethodReturnStatementsNode::class;
    }

    /**
     * @param MethodReturnStatementsNode $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $controller = $scope->getClassReflection();

        if ($controller === null || (! $controller->is('App\\Http\\Controllers\\Controller') && ! $controller->is(Controller::class))) {
            return [];
        }

        $method = $node->getMethodReflection();

        if (! $method->isPublic() || $method->isAbstract()->yes() || $method->isConstructor() || in_array(strtolower($method->getName()), [
            '__construct', '__destruct', '__call', '__callstatic', '__get', '__set',
            '__isset', '__unset', '__sleep', '__wakeup', '__tostring', '__set_state',
            '__clone', '__debuginfo', '__serialize', '__unserialize',
        ], true)) {
            return [];
        }

        $error = static function (string $reason, int $line): RuleError {
            return RuleErrorBuilder::message($reason.' Controller actions must return Symfony\Component\HttpFoundation\Response, Inertia\Response, or Illuminate\Http\Resources\Json\JsonResource (including subclasses and resource collections). Wrap data in an approved response or resource.')
                ->identifier('workspace.controller.allowedReturnTypes')
                ->line($line)
                ->build();
        };

        // Even an unreachable yield makes the action a generator. Scan its own
        // body without entering nested functions, closures, or classes.
        $nodes = $node->getStatements();

        while ($nodes !== []) {
            $current = array_pop($nodes);

            if ($current instanceof FunctionLike || $current instanceof Node\Stmt\ClassLike) {
                continue;
            }

            if ($current instanceof Node\Expr\Yield_ || $current instanceof Node\Expr\YieldFrom) {
                return [$error('This action returns a Generator.', $current->getStartLine())];
            }

            foreach ($current->getSubNodeNames() as $name) {
                $children = $current->{$name};

                if ($children instanceof Node) {
                    $nodes[] = $children;
                } elseif (is_array($children)) {
                    foreach ($children as $child) {
                        if ($child instanceof Node) {
                            $nodes[] = $child;
                        }
                    }
                }
            }
        }

        $allowedType = TypeCombinator::union(
            new ObjectType(SymfonyResponse::class),
            new ObjectType(InertiaResponse::class),
            new ObjectType(JsonResource::class),
        );
        $errors = [];

        foreach ($node->getReturnStatements() as $returnStatement) {
            $return = $returnStatement->getReturnNode();

            if ($return->expr === null) {
                $errors[] = $error('An empty return produces no response.', $return->getStartLine());

                continue;
            }

            $returnType = $returnStatement->getScope()->getType($return->expr);

            // A definite subtype includes every union member; mixed and unknown
            // types fail, while never-returning expressions produce no value.
            if (! $allowedType->isSuperTypeOf($returnType)->yes()) {
                $errors[] = $error('Returned type: '.$returnType->describe(VerbosityLevel::typeOnly()).'.', $return->getStartLine());
            }
        }

        if (! $node->getStatementResult()->isAlwaysTerminating()) {
            $errors[] = $error('This action can finish without returning a response.', $node->getEndLine());
        }

        return $errors;
    }
}
