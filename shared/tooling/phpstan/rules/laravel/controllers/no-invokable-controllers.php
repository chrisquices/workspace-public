<?php

namespace Workspace\PHPStan\Controllers;

use Illuminate\Routing\Controller;
use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class NoInvokableControllers implements Rule
{
    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @param InClassNode $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        $controller = $node->getClassReflection();

        if (! $node->getOriginalNode() instanceof Node\Stmt\Class_
            || (! $this->isControllerFile($scope)
                && ! $controller->is('App\\Http\\Controllers\\Controller')
                && ! $controller->is(Controller::class))
            || ! $controller->hasNativeMethod('__invoke')) {
            return [];
        }

        return [
            RuleErrorBuilder::message('Invokable controllers are forbidden. Do not define or inherit __invoke(). Move the action into an explicitly named method on a controller for its model, module, or domain.')
                ->identifier('workspace.controller.noInvokableControllers')
                ->line($node->getStartLine())
                ->build(),
        ];
    }

    private function isControllerFile(Scope $scope): bool
    {
        $namespace = $scope->getNamespace() ?? '';
        $file = str_replace('\\', '/', $scope->getFile());

        return $namespace === 'App\\Http\\Controllers'
            || str_starts_with($namespace, 'App\\Http\\Controllers\\')
            || str_contains($file, '/app/Http/Controllers/');
    }
}
