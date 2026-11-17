<?php

namespace Workspace\PHPStan\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Controller;
use PhpParser\Node;
use PhpParser\Node\IntersectionType;
use PhpParser\Node\Name;
use PhpParser\Node\NullableType;
use PhpParser\Node\Stmt\Class_;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\UnionType;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireMatchingControllerModule implements Rule
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

        if ($class->isSubclassOf(FormRequest::class)) {
            return [];
        }

        $errors = [];

        foreach ($declaration->getMethods() as $method) {
            array_push($errors, ...$this->enforceControllerModule($method, $scope));
        }

        return $errors;
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
    private function enforceControllerModule(ClassMethod $node, Scope $scope): array
    {
        $controller = $scope->getClassReflection();

        if ($controller === null || $controller->isAnonymous()) {
            return [];
        }

        $namespace = $scope->getNamespace() ?? '';
        $file = str_replace('\\', '/', $scope->getFile());

        if ($namespace !== 'App\\Http\\Controllers' && ! str_starts_with($namespace, 'App\\Http\\Controllers\\')
            && ! str_contains($file, '/app/Http/Controllers/')
            && ! $controller->is('App\\Http\\Controllers\\Controller') && ! $controller->is(Controller::class)) {
            return [];
        }

        $controllerName = basename(str_replace('\\', '/', $controller->getName()));

        if ($controllerName === 'Controller' || ! str_ends_with($controllerName, 'Controller')) {
            return [];
        }

        $module = substr($controllerName, 0, -strlen('Controller'));
        $controllerNamespace = 'App\\Http\\Controllers';
        $group = str_starts_with($namespace, $controllerNamespace.'\\') ? substr($namespace, strlen($controllerNamespace) + 1).'\\' : '';
        $modulePath = str_replace('\\', '/', $group.$module);
        $expectedNamespace = 'App\\Http\\Requests\\'.$group.$module;
        $errors = [];

        foreach ($node->params as $parameter) {
            $types = [$parameter->type];
            $checked = [];

            while ($types !== []) {
                $type = array_pop($types);

                if ($type instanceof NullableType) {
                    $types[] = $type->type;
                } elseif ($type instanceof UnionType || $type instanceof IntersectionType) {
                    array_push($types, ...$type->types);
                } elseif ($type instanceof Name) {
                    foreach ($scope->resolveTypeByName($type)->getObjectClassReflections() as $request) {
                        if (! $request->isSubclassOf(FormRequest::class) || isset($checked[$request->getName()])) {
                            continue;
                        }

                        $checked[$request->getName()] = true;
                        $requestFile = $request->getFileName();
                        $separator = strrpos($request->getName(), '\\');
                        $requestNamespace = $separator === false ? '' : substr($request->getName(), 0, $separator);

                        if ($requestFile !== null && $this->requestModule($requestFile) === $modulePath && $requestNamespace === $expectedNamespace) {
                            continue;
                        }

                        $errors[] = $this->error($parameter, __FUNCTION__, sprintf('Form Request %s used by %s must belong to module %s. Place it in app/Http/Requests/%s/ with namespace %s and an <Action>%sRequest class and matching filename.', $request->getName(), $controllerName, $module, $modulePath, $expectedNamespace, $module));
                    }
                }
            }
        }

        return $errors;
    }

    private function error(Node $node, string $method, string $message): RuleError
    {
        return RuleErrorBuilder::message($message)
            ->identifier('workspace.request.'.$method)
            ->line($node->getStartLine())
            ->build();
    }
}
