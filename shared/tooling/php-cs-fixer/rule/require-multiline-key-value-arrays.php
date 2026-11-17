<?php

namespace Workspace\PHPcsFixer;

use PhpCsFixer\Fixer\WhitespacesAwareFixerInterface;
use PhpCsFixer\FixerDefinition\CodeSample;
use PhpCsFixer\FixerDefinition\FixerDefinition;
use PhpCsFixer\FixerDefinition\FixerDefinitionInterface;
use PhpCsFixer\Tokenizer\CT;
use PhpCsFixer\Tokenizer\Token;
use PhpCsFixer\Tokenizer\Tokens;
use PhpCsFixer\WhitespacesFixerConfig;
use SplFileInfo;

final class RequireMultilineArrays implements WhitespacesAwareFixerInterface
{
    private WhitespacesFixerConfig $whitespaces;

    public function __construct()
    {
        $this->whitespaces = new WhitespacesFixerConfig;
    }

    public function getName(): string
    {
        return 'Workspace/require_multiline_arrays';
    }

    public function getDefinition(): FixerDefinitionInterface
    {
        return new FixerDefinition('Expand arrays containing explicit key-value pairs and collapse plain lists whose items contain no comments or line breaks.', [new CodeSample("<?php\nreturn ['title' => \$title];\n")]);
    }

    public function isCandidate(Tokens $tokens): bool
    {
        return $tokens->isAnyTokenKindsFound([T_ARRAY, CT::T_ARRAY_BRACKET_OPEN]);
    }

    public function isRisky(): bool
    {
        return false;
    }

    public function getPriority(): int
    {
        return 0;
    }

    public function supports(SplFileInfo $file): bool
    {
        return str_ends_with($file->getFilename(), '.php')
            && ! str_ends_with($file->getFilename(), '.blade.php');
    }

    public function setWhitespacesConfig(WhitespacesFixerConfig $config): void
    {
        $this->whitespaces = $config;
    }

    public function fix(SplFileInfo $file, Tokens $tokens): void
    {
        if (! $this->supports($file) || ! $this->isCandidate($tokens)) {
            return;
        }

        $lists = [];

        // Format parents first so nested arrays inherit their final indentation.
        for ($open = 0; $open < count($tokens); $open++) {
            $previous = $tokens->getPrevMeaningfulToken($open);

            if (! $tokens[$open]->isGivenKind(CT::T_ARRAY_BRACKET_OPEN)
                && ! ($tokens[$open]->equals('(') && $previous !== null && $tokens[$previous]->isGivenKind(T_ARRAY))) {
                continue;
            }

            $block = Tokens::detectBlockType($tokens[$open]);
            $close = $tokens->findBlockEnd($block['type'], $open);

            if (! $this->hasKeyValuePairs($tokens, $open, $close)) {
                $lists[] = $open;

                continue;
            }

            $this->formatArray($tokens, $open, $close);
        }

        // Collapse children first so a parent can also collapse in the same run.
        foreach (array_reverse($lists) as $open) {
            $block = Tokens::detectBlockType($tokens[$open]);
            $close = $tokens->findBlockEnd($block['type'], $open);
            $this->collapseList($tokens, $open, $close);
        }
    }

    private function collapseList(Tokens $tokens, int $open, int $close): void
    {
        if (! preg_match('/\r\n|\n|\r/', $tokens->generatePartialCode($open, $close))) {
            return;
        }

        $ranges = [];
        $start = $open + 1;

        for ($index = $start; $index < $close; $index++) {
            $block = Tokens::detectBlockType($tokens[$index]);

            if ($block !== null && $block['isStart']) {
                $index = $tokens->findBlockEnd($block['type'], $index);
            } elseif ($tokens[$index]->equals(',')) {
                $ranges[] = [$start, $index - 1];
                $start = $index + 1;
            }
        }

        $ranges[] = [$start, $close - 1];
        $replacement = [$tokens[$open]];
        $hasItems = false;

        foreach ($ranges as [$first, $last]) {
            while ($first <= $last && $tokens[$first]->isWhitespace()) {
                $first++;
            }

            while ($last >= $first && $tokens[$last]->isWhitespace()) {
                $last--;
            }

            // The final range can be empty after a trailing comma, or in [].
            if ($first > $last) {
                continue;
            }

            if ($hasItems) {
                $replacement[] = new Token(',');
                $replacement[] = new Token([T_WHITESPACE, ' ']);
            }

            for ($index = $first; $index <= $last; $index++) {

                // Only remove spacing between items; never flatten an expression.
                if ($tokens[$index]->isComment() || preg_match('/\r\n|\n|\r/', $tokens[$index]->getContent())) {
                    return;
                }

                $replacement[] = $tokens[$index];
            }

            $hasItems = true;
        }

        $replacement[] = $tokens[$close];
        $tokens->overrideRange($open, $close, $replacement);
        $tokens->clearEmptyTokens();
    }

    private function hasKeyValuePairs(Tokens $tokens, int $open, int $close): bool
    {
        $ignoreArrows = false;

        for ($index = $open + 1; $index < $close; $index++) {
            $block = Tokens::detectBlockType($tokens[$index]);

            if ($block !== null && $block['isStart']) {
                $index = $tokens->findBlockEnd($block['type'], $index);
            } elseif ($tokens[$index]->equals(',')) {
                $ignoreArrows = false;
            } elseif ($tokens[$index]->isGivenKind([T_FN, T_YIELD])) {

                // Arrows belonging to these expressions are not array keys.
                $ignoreArrows = true;
            } elseif (! $ignoreArrows && $tokens[$index]->isGivenKind(T_DOUBLE_ARROW)) {
                return true;
            }
        }

        return false;
    }

    private function formatArray(Tokens $tokens, int $open, int $close): void
    {
        $indent = $this->lineIndent($tokens, $open);
        $itemIndent = $indent.$this->whitespaces->getIndent();
        $starts = [$this->nextContent($tokens, $open)];
        $ends = [];

        for ($index = $open + 1; $index < $close; $index++) {
            $block = Tokens::detectBlockType($tokens[$index]);

            if ($block !== null && $block['isStart']) {
                $index = $tokens->findBlockEnd($block['type'], $index);
            } elseif ($tokens[$index]->equals(',')) {
                $ends[] = $index;
                $next = $this->afterTrailingComments($tokens, $index, $close);

                if ($next < $close) {
                    $starts[] = $next;
                }
            }
        }

        $ends[] = $close;

        foreach ($starts as $position => $start) {
            $this->indentContinuation($tokens, $start, $ends[$position], $itemIndent);
        }

        // Apply edits backwards so insertions cannot invalidate earlier indexes.
        $this->breakBefore($tokens, $close, $indent);
        $last = $tokens->getPrevMeaningfulToken($close);

        if ($last !== null && ! $tokens[$last]->equals(',')) {
            $tokens->insertAt($last + 1, new Token(','));
        }

        foreach (array_reverse($starts) as $start) {
            $this->breakBefore($tokens, $start, $itemIndent);
        }
    }

    private function nextContent(Tokens $tokens, int $index): int
    {
        do {
            $index++;
        } while ($tokens[$index]->isWhitespace());

        return $index;
    }

    private function afterTrailingComments(Tokens $tokens, int $index, int $close): int
    {
        $next = $this->nextContent($tokens, $index);

        // Keep same-line comments attached to the item preceding the comma.
        while ($next < $close && $tokens[$next]->isComment()) {
            $between = $tokens->generatePartialCode($index + 1, $next - 1);

            if (preg_match('/\r\n|\n|\r/', $between)) {
                break;
            }

            $index = $next;
            $next = $this->nextContent($tokens, $index);
        }

        return $next;
    }

    private function breakBefore(Tokens $tokens, int $index, string $indent): void
    {
        $whitespace = $this->whitespaces->getLineEnding().$indent;

        if ($tokens[$index - 1]->isWhitespace()) {
            $existing = $tokens[$index - 1]->getContent();

            if (preg_match('/\r\n|\n|\r/', $existing)) {
                $whitespace = rtrim($existing, " \t").$indent;
            }

            $tokens[$index - 1] = new Token([T_WHITESPACE, $whitespace]);
        } else {
            $tokens->insertAt($index, new Token([T_WHITESPACE, $whitespace]));
        }
    }

    private function indentContinuation(Tokens $tokens, int $start, int $end, string $indent): void
    {
        $original = $this->lineIndent($tokens, $start);

        if ($original === $indent) {
            return;
        }

        for ($index = $start + 1; $index < $end; $index++) {
            if (! $tokens[$index]->isWhitespace()) {
                continue;
            }

            $content = preg_replace_callback('/(\r\n|\n|\r)([\t ]*)\z/', static function (array $matches) use ($original, $indent): string {
                return str_starts_with($matches[2], $original)
                    ? $matches[1].$indent.substr($matches[2], strlen($original))
                    : $matches[0];
            }, $tokens[$index]->getContent());

            $tokens[$index] = new Token([T_WHITESPACE, $content]);
        }
    }

    private function lineIndent(Tokens $tokens, int $index): string
    {
        $line = '';

        for ($index--; $index >= 0; $index--) {
            $content = $tokens[$index]->getContent();
            $lf = strrpos($content, "\n");
            $cr = strrpos($content, "\r");
            $newline = max($lf === false ? -1 : $lf, $cr === false ? -1 : $cr);

            if ($newline >= 0) {
                $line = substr($content, $newline + 1).$line;

                break;
            }

            $line = $content.$line;
        }

        preg_match('/^[\t ]*/', $line, $matches);

        return $matches[0] ?? '';
    }
}
