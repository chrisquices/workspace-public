<?php

use PhpCsFixer\Config;
use PhpCsFixer\Finder;
use Workspace\PHPcsFixer\RequireBlankLineAboveComments;
use Workspace\PHPcsFixer\RequireBlankLineAfterGateAuthorize;
use Workspace\PHPcsFixer\RequireBlankLineAfterResourceAssignment;
use Workspace\PHPcsFixer\RequireBlankLinesAroundRawResultPairs;
use Workspace\PHPcsFixer\RequireMultilineArrays;
use Workspace\PHPcsFixer\RequireMultiLineQueryChains;

require_once __DIR__.'/rule/require-blank-line-above-comments.php';
require_once __DIR__.'/rule/require-blank-line-after-gate-authorize.php';
require_once __DIR__.'/rule/require-blank-line-after-resource-assignment.php';
require_once __DIR__.'/rule/require-blank-lines-around-raw-result-pairs.php';
require_once __DIR__.'/rule/require-multiline-key-value-arrays.php';
require_once __DIR__.'/rule/require-multi-line-query-chains.php';

$projectDirectory = getcwd();

if ($projectDirectory === false) {
    throw new RuntimeException('Unable to determine the project directory.');
}

return (new Config)
    ->registerCustomFixers([
        new RequireBlankLineAboveComments,
        new RequireBlankLineAfterGateAuthorize,
        new RequireBlankLineAfterResourceAssignment,
        new RequireBlankLinesAroundRawResultPairs,
        new RequireMultilineArrays,
        new RequireMultiLineQueryChains,
    ])
    ->setRules([
        'Workspace/require_blank_line_above_comments' => true,
        'Workspace/require_blank_line_after_gate_authorize' => true,
        'Workspace/require_blank_line_after_resource_assignment' => true,
        'Workspace/require_blank_lines_around_raw_result_pairs' => true,
        'Workspace/require_multiline_arrays' => true,
        'Workspace/require_multi_line_query_chains' => true,
    ])
    ->setUsingCache(false)
    ->setFinder(Finder::create()
        ->in($projectDirectory)
        ->exclude([
            'bootstrap/cache',
            'build',
            'nativephp',
            'node_modules',
            'storage',
        ])
        ->notName([
            '*.blade.php',
            '_ide_helper_actions.php',
            '_ide_helper_models.php',
            '_ide_helper.php',
            '.phpstorm.meta.php',
        ]));
