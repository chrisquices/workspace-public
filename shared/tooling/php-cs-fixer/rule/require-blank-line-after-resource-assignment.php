<?php

namespace Workspace\PHPcsFixer;

use PhpCsFixer\Fixer\FixerInterface;
use PhpCsFixer\FixerDefinition\CodeSample;
use PhpCsFixer\FixerDefinition\FixerDefinition;
use PhpCsFixer\FixerDefinition\FixerDefinitionInterface;
use PhpCsFixer\Tokenizer\CT;
use PhpCsFixer\Tokenizer\Token;
use PhpCsFixer\Tokenizer\Tokens;
use SplFileInfo;

final class RequireBlankLineAfterResourceAssignment implements FixerInterface
{
    public function getName(): string
    {
        return 'Workspace/require_blank_line_after_resource_assignment';
    }

    public function getDefinition(): FixerDefinitionInterface
    {
        return new FixerDefinition('Add a blank line after the initial resource assignment in resource toArray() methods.', [
            new CodeSample("<?php\nclass ExampleResource { public function toArray(): array { \$resource = \$this->resource; return []; } }\n"),
        ]);
    }

    public function isCandidate(Tokens $tokens): bool
    {
        return $tokens->isTokenKindFound(T_FUNCTION) && $tokens->isTokenKindFound(T_OBJECT_OPERATOR);
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

        return str_contains($path, '/app/Http/Resources/')
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
            if (! $tokens[$index]->isGivenKind(T_FUNCTION)) {
                continue;
            }

            $assignment = $this->initialAssignment($tokens, $index);

            if ($assignment !== null) {
                [$start, $end] = $assignment;
                $this->ensureBlankLineAfter($tokens, $end, $newline, $this->lineIndent($tokens, $start));
            }
        }
    }

    /** @return array{int, int}|null */
    private function initialAssignment(Tokens $tokens, int $function): ?array
    {
        $name = $tokens->getNextMeaningfulToken($function);

        if ($name !== null && $tokens[$name]->equals('&')) {
            $name = $tokens->getNextMeaningfulToken($name);
        }

        if ($name === null || ! $tokens[$name]->isGivenKind(T_STRING) || strtolower($tokens[$name]->getContent()) !== 'toarray') {
            return null;
        }

        $open = $tokens->getNextMeaningfulToken($name);

        if ($open === null || ! $tokens[$open]->equals('(')) {
            return null;
        }

        $close = $tokens->findBlockEnd(Tokens::BLOCK_TYPE_PARENTHESIS, $open);
        $body = $tokens->getNextMeaningfulToken($close);

        while ($body !== null && ! $tokens[$body]->equals('{')) {
            if ($tokens[$body]->equals(';')) {
                return null;
            }

            if ($tokens[$body]->equals('(')) {
                $body = $tokens->findBlockEnd(Tokens::BLOCK_TYPE_PARENTHESIS, $body);
            }

            $body = $tokens->getNextMeaningfulToken($body);
        }

        $start = $body === null ? null : $tokens->getNextMeaningfulToken($body);
        $equals = $start === null ? null : $tokens->getNextMeaningfulToken($start);
        $receiver = $equals === null ? null : $tokens->getNextMeaningfulToken($equals);
        $operator = $receiver === null ? null : $tokens->getNextMeaningfulToken($receiver);
        $property = $operator === null ? null : $tokens->getNextMeaningfulToken($operator);

        if ($start === null || ! $tokens[$start]->isGivenKind(T_VARIABLE)
            || $equals === null || ! $tokens[$equals]->equals('=')
            || $receiver === null || ! $tokens[$receiver]->equals([T_VARIABLE, '$this'])
            || $operator === null || ! $tokens[$operator]->isGivenKind(T_OBJECT_OPERATOR)
            || $property === null) {
            return null;
        }

        if ($tokens[$property]->isGivenKind(CT::T_DYNAMIC_PROP_BRACE_OPEN)) {
            $name = $tokens->getNextMeaningfulToken($property);
            $close = $name === null ? null : $tokens->getNextMeaningfulToken($name);

            if ($name === null || ! $tokens[$name]->isGivenKind(T_CONSTANT_ENCAPSED_STRING)
                || ! in_array($tokens[$name]->getContent(), ["'resource'", '"resource"'], true)
                || $close === null || ! $tokens[$close]->isGivenKind(CT::T_DYNAMIC_PROP_BRACE_CLOSE)) {
                return null;
            }

            $property = $close;
        } elseif (! $tokens[$property]->equals([T_STRING, 'resource'])) {
            return null;
        }

        $end = $tokens->getNextMeaningfulToken($property);

        return $end !== null && $tokens[$end]->equals(';') ? [$start, $end] : null;
    }

    private function ensureBlankLineAfter(Tokens $tokens, int $end, string $newline, string $indent): void
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
