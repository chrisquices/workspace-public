<?php

namespace Workspace\PHPStan\Requests;

use Illuminate\Foundation\Http\FormRequest;
use PhpParser\Node;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt\Class_;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireActionFirstName implements Rule
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

        return $module !== null
            ? $this->enforceActionFirstName($node, $scope, basename($module), $declaration->name->toString())
            : [];
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
    private function enforceActionFirstName(InClassNode $node, Scope $scope, string $module, string $className): array
    {
        $fileName = basename(str_replace('\\', '/', $scope->getFile()));

        if ($fileName === $className.'.php'
            && preg_match('/^[A-Z][A-Za-z0-9]*'.preg_quote($module, '/').'Request$/D', $className) === 1) {
            return [];
        }

        return [$this->error($node, __FUNCTION__, sprintf('Name this Form Request <Action>%sRequest and save it as <Action>%sRequest.php, for example Store%sRequest.php. Put a nonempty PascalCase action before the exact module name %s, followed by Request. The class name must exactly match the filename.', $module, $module, $module, $module))];
    }

    private function error(Node $node, string $method, string $message): RuleError
    {
        return RuleErrorBuilder::message($message)
            ->identifier('workspace.request.'.$method)
            ->line($node->getStartLine())
            ->build();
    }
}
