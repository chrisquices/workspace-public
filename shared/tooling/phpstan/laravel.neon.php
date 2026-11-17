<?php

require_once __DIR__.'/phpstan.neon.php';

$config = \Workspace\PHPStan\loadRules([
    __DIR__.'/helpers/routes',
    __DIR__.'/rules/laravel',
]);

$config['services'][] = [
    'class' => \Workspace\PHPStan\Resources\ResourceDirectoryCollector::class,
    'tags' => ['phpstan.collector'],
];
$config['services'][] = [
    'class' => \Workspace\PHPStan\Resources\ResourceDirectorySnapshot::class,
    'tags' => ['phpstan.resultCacheValueExtension'],
];

return $config;
