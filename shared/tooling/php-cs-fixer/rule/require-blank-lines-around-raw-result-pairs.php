<?php

namespace Workspace\PHPcsFixer;

use PhpCsFixer\Fixer\FixerInterface;
use PhpCsFixer\FixerDefinition\CodeSample;
use PhpCsFixer\FixerDefinition\FixerDefinition;
use PhpCsFixer\FixerDefinition\FixerDefinitionInterface;
use PhpCsFixer\Tokenizer\Token;
use PhpCsFixer\Tokenizer\Tokens;
use SplFileInfo;

final class RequireBlankLinesAroundRawResultPairs implements FixerInterface
{
    public function getName(): string
    {
        return 'Workspace/require_blank_lines_around_raw_result_pairs';
    }

    public function getDefinition(): FixerDefinitionInterface
    {
        return new FixerDefinition('Separate adjacent raw and result assignment pairs with blank lines.', [
            new CodeSample("<?php\n\$usersRaw = getUsers();\n\$users = formatUsers(\$usersRaw);\n"),
        ]);
    }

    public function isCandidate(Tokens $tokens): bool
    {
        return $tokens->isTokenKindFound(T_VARIABLE);
    }

    public function isRisky(): bool
    {
        return false;
    }

    public function getPriority(): int
    {
        return -100;
    }

    public function supports(SplFileInfo $file): bool
    {
        $path = '/'.ltrim(str_replace('\\', '/', $file->getPathname()), '/');

        return str_contains($path, '/app/Http/Controllers/')
            && str_ends_with($file->getFilename(), '.php')
            && ! str_ends_with($file->getFilename(), '.blade.php');
    }

    public function fix(SplFileInfo $file, Tokens $tokens): void
    {
        if (! $this->supports($file) || ! $this->isCandidate($tokens)) {
            return;
        }

        preg_match('/\r\n|\n|\r/', $tokens->generateCode(), $matches);
        $newline = $matches[0] ?? "\n";

        for ($index = count($tokens) - 1; $index >= 0; $index--) {
            $pair = $this->findPair($tokens, $index);

            if ($pair === null) {
                continue;
            }

            [$rawEnd, $resultStart, $resultEnd] = $pair;
            $indent = $this->lineIndent($tokens, $index);

            $this->ensureBlankAfter($tokens, $resultEnd, $newline, $indent);
            $this->formatBetween($tokens, $rawEnd, $resultStart, $newline, $indent);
            $this->ensureBlankBefore($tokens, $this->groupStart($tokens, $index), $newline, $indent);
        }
    }

    /** @return array{int, int, int}|null */
    private function findPair(Tokens $tokens, int $start): ?array
    {
        if (! $tokens[$start]->isGivenKind(T_VARIABLE)) {
            return null;
        }

        $rawName = $tokens[$start]->getContent();

        if (! str_ends_with($rawName, 'Raw') || strlen($rawName) <= 4) {
            return null;
        }

        $previous = $tokens->getPrevMeaningfulToken($start);
        $equals = $tokens->getNextMeaningfulToken($start);

        if ($previous === null || ! $tokens[$previous]->equalsAny([';', '{', '}', ':'])
            || $equals === null || ! $tokens[$equals]->equals('=')) {
            return null;
        }

        $rawEnd = $this->statementEnd($tokens, $equals);
        $resultStart = $rawEnd === null ? null : $tokens->getNextMeaningfulToken($rawEnd);

        if ($resultStart === null || ! $tokens[$resultStart]->isGivenKind(T_VARIABLE)
            || $tokens[$resultStart]->getContent() !== substr($rawName, 0, -3)) {
            return null;
        }

        $resultEquals = $tokens->getNextMeaningfulToken($resultStart);

        if ($resultEquals === null || ! $tokens[$resultEquals]->equals('=')) {
            return null;
        }

        $resultEnd = $this->statementEnd($tokens, $resultEquals);

        if ($resultEnd === null) {
            return null;
        }

        for ($index = $resultEquals + 1; $index < $resultEnd; $index++) {
            if ($tokens[$index]->isGivenKind(T_VARIABLE) && $tokens[$index]->getContent() === $rawName) {
                return [$rawEnd, $resultStart, $resultEnd];
            }
        }

        return null;
    }

    private function statementEnd(Tokens $tokens, int $start): ?int
    {
        for ($index = $start + 1; $index < count($tokens); $index++) {
            $block = Tokens::detectBlockType($tokens[$index]);

            if ($block !== null) {
                if (! $block['isStart']) {
                    return null;
                }

                $index = $tokens->findBlockEnd($block['type'], $index);

                continue;
            }

            if ($tokens[$index]->equals(';')) {
                return $index;
            }
        }

        return null;
    }

    private function formatBetween(Tokens $tokens, int $rawEnd, int $resultStart, string $newline, string $indent): void
    {
        $hasComment = false;
        $hasLineBreak = false;

        for ($index = $rawEnd + 1; $index < $resultStart; $index++) {
            $hasComment = $hasComment || $tokens[$index]->isComment();
            $hasLineBreak = $hasLineBreak || preg_match('/\r\n|\n|\r/', $tokens[$index]->getContent()) === 1;
        }

        if ($hasComment && $hasLineBreak) {
            return;
        }

        $before = $resultStart - 1;

        if ($tokens[$before]->isWhitespace()) {
            $tokens[$before] = new Token([T_WHITESPACE, $newline.$indent]);
        } else {
            $tokens->insertAt($resultStart, new Token([T_WHITESPACE, $newline.$indent]));
        }
    }

    private function groupStart(Tokens $tokens, int $start): int
    {
        while ($start > 0) {
            $index = $start - 1;
            $spacing = '';

            while ($index >= 0 && $tokens[$index]->isWhitespace()) {
                $spacing = $tokens[$index]->getContent().$spacing;
                $index--;
            }

            if ($index < 0 || ! $tokens[$index]->isComment()
                || preg_match_all('/\r\n|\n|\r/', $spacing) >= 2
                || ! $this->isStandaloneComment($tokens, $index)) {
                break;
            }

            $start = $index;
        }

        return $start;
    }

    private function isStandaloneComment(Tokens $tokens, int $index): bool
    {
        for ($index--; $index >= 0; $index--) {
            $content = $tokens[$index]->getContent();
            $lf = strrpos($content, "\n");
            $cr = strrpos($content, "\r");
            $lineBreak = max($lf === false ? -1 : $lf, $cr === false ? -1 : $cr);

            if ($lineBreak >= 0) {
                return trim(substr($content, $lineBreak + 1)) === '';
            }

            if (trim($content) !== '') {
                return false;
            }
        }

        return true;
    }

    private function ensureBlankBefore(Tokens $tokens, int $start, string $newline, string $indent): void
    {
        $previous = $start - 1;
        $whitespace = $previous >= 0 && $tokens[$previous]->isWhitespace() ? $tokens[$previous]->getContent() : '';
        $count = preg_match_all('/\r\n|\n|\r/', $whitespace);

        if ($count >= 2) {
            return;
        }

        $replacement = $count === 1 ? $newline.$whitespace : $newline.$newline.$indent;

        if ($whitespace !== '') {
            $tokens[$previous] = new Token([T_WHITESPACE, $replacement]);
        } else {
            $tokens->insertAt($start, new Token([T_WHITESPACE, $replacement]));
        }
    }

    private function ensureBlankAfter(Tokens $tokens, int $end, string $newline, string $indent): void
    {
        while (true) {
            $next = $end + 1;
            $whitespace = isset($tokens[$next]) && $tokens[$next]->isWhitespace() ? $tokens[$next]->getContent() : '';
            $comment = $whitespace === '' ? $next : $next + 1;

            if (! isset($tokens[$comment]) || ! $tokens[$comment]->isComment()
                || preg_match('/\r\n|\n|\r/', $whitespace) === 1) {
                break;
            }

            $end = $comment;
        }

        $count = preg_match_all('/\r\n|\n|\r/', $whitespace);

        if ($count >= 2) {
            return;
        }

        $replacement = $count === 1 ? $newline.$whitespace : $newline.$newline.$indent;

        if ($whitespace !== '') {
            $tokens[$next] = new Token([T_WHITESPACE, $replacement]);
        } else {
            $tokens->insertAt($next, new Token([T_WHITESPACE, $replacement]));
        }
    }

    private function lineIndent(Tokens $tokens, int $index): string
    {
        $line = '';

        for ($index--; $index >= 0; $index--) {
            $content = $tokens[$index]->getContent();
            $lf = strrpos($content, "\n");
            $cr = strrpos($content, "\r");
            $lineBreak = max($lf === false ? -1 : $lf, $cr === false ? -1 : $cr);

            if ($lineBreak >= 0) {
                $line = substr($content, $lineBreak + 1).$line;

                break;
            }

            $line = $content.$line;
        }

        preg_match('/^[\t ]*/', $line, $matches);

        return $matches[0] ?? '';
    }
}
