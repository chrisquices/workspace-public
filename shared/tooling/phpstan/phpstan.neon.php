<?php

namespace Workspace\PHPStan;

use FilesystemIterator;
use PHPStan\Parser\Parser;
use PHPStan\Rules\Rule;
use ReflectionClass;
use ReflectionNamedType;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

if (! function_exists(__NAMESPACE__.'\\loadRules')) {
    /**
     * @param list<string> $directories
     * @return array{services: list<array<string, mixed>>}
     */
    function loadRules(array $directories): array
    {
        $files = [];

        foreach ($directories as $directory) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));

            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $files[$file->getRealPath()] = true;
                }
            }
        }

        ksort($files);

        foreach (array_keys($files) as $file) {
            require_once $file;
        }

        $services = [];

        foreach (get_declared_classes() as $class) {
            $reflection = new ReflectionClass($class);

            if (! isset($files[$reflection->getFileName()]) || ! $reflection->isInstantiable() || ! $reflection->implementsInterface(Rule::class)) {
                continue;
            }

            $service = [
                'class' => $class,
                'tags' => ['phpstan.rules.rule'],
            ];

            foreach ($reflection->getConstructor()?->getParameters() ?? [] as $parameter) {
                $type = $parameter->getType();

                if ($type instanceof ReflectionNamedType && $type->getName() === Parser::class) {
                    $service['arguments'][$parameter->getName()] = '@defaultAnalysisParser';
                }
            }

            $services[$class] = $service;
        }

        ksort($services);

        return ['services' => array_values($services)];
    }
}

$config = loadRules([__DIR__.'/rules/general']);
$projectDirectory = getcwd();

if ($projectDirectory === false) {
    throw new \RuntimeException('Unable to determine the project directory.');
}

$cacheFiles = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__, FilesystemIterator::SKIP_DOTS));

foreach ($iterator as $file) {
    if ($file->isFile() && in_array($file->getExtension(), ['php', 'neon'], true)) {
        $cacheFiles[] = $file->getPathname();
    }
}

sort($cacheFiles);

// Added or removed rule files must rebuild PHPStan's cached service container.
$config['parameters']['tmpDir'] = sys_get_temp_dir().'/workspace-phpstan/'.hash('sha256', __DIR__."\0".$projectDirectory."\0".implode("\0", $cacheFiles));

return $config;
