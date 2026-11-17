<?php

namespace Workspace\PHPStan\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\Stmt\Class_;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireModuleDirectory implements Rule
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
        $class = $node->getClassReflection();
        $declaration = $node->getOriginalNode();

        if (! $declaration instanceof Class_ || $declaration->name === null || $class->isAnonymous()) {
            return [];
        }

        if (! $class->isSubclassOf(FormRequest::class)) {
            return [];
        }

        $module = $this->requestModule($scope->getFile());

        return $this->enforceModuleDirectory($node, $scope, $module);
    }

    private function requestModule(string $file): ?string
    {
        $root = getcwd();

        if ($root === false) {
            return null;
        }

        $prefix = rtrim(str_replace('\\', '/', realpath($root) ?: $root), '/').'/app/Http/Requests/';
        $file = str_replace('\\', '/', realpath($file) ?: $file);

        if (! str_starts_with($file, $prefix)) {
            return null;
        }

        $parts = explode('/', substr($file, strlen($prefix)));
        array_pop($parts);

        if ($parts === []) {
            return null;
        }

        foreach ($parts as $part) {
            if (preg_match('/^[A-Z][A-Za-z0-9]*$/D', $part) !== 1) {
                return null;
            }
        }

        return implode('/', $parts);
    }

    /** @return list<RuleError> */
    private function enforceModuleDirectory(InClassNode $node, Scope $scope, ?string $module): array
    {
        if ($module === null) {
            return [$this->error($node, __FUNCTION__, 'Place Form Requests in a module folder under app/Http/Requests/, mirroring the controller namespace. For example, Auth/LoginController uses app/Http/Requests/Auth/Login/SubmitLoginRequest.php. Do not place requests directly in Requests/.')];
        }

        $namespace = 'App\\Http\\Requests\\'.str_replace('/', '\\', $module);

        if ($scope->getNamespace() !== $namespace) {
            return [$this->error($node, __FUNCTION__, sprintf('The request namespace must be %s to match its app/Http/Requests/%s/ folder.', $namespace, $module))];
        }

        return [];
    }

    private function error(Node $node, string $method, string $message): RuleError
    {
        return RuleErrorBuilder::message($message)
            ->identifier('workspace.request.'.$method)
            ->line($node->getStartLine())
            ->build();
    }
}
