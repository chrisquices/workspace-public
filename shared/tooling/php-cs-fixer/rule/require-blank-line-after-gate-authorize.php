<?php

namespace Workspace\PHPcsFixer;

use PhpCsFixer\Fixer\FixerInterface;
use PhpCsFixer\FixerDefinition\CodeSample;
use PhpCsFixer\FixerDefinition\FixerDefinition;
use PhpCsFixer\FixerDefinition\FixerDefinitionInterface;
use PhpCsFixer\Tokenizer\Token;
use PhpCsFixer\Tokenizer\Tokens;
use SplFileInfo;

final class RequireBlankLineAfterGateAuthorize implements FixerInterface
{
    public function getName(): string
    {
        return 'Workspace/require_blank_line_after_gate_authorize';
    }

    public function getDefinition(): FixerDefinitionInterface
    {
        return new FixerDefinition('Add a blank line after standalone Gate::authorize() statements.', [
            new CodeSample("<?php\nuse Illuminate\\Support\\Facades\\Gate;\nGate::authorize('view');\nreturn true;\n"),
        ]);
    }

    public function isCandidate(Tokens $tokens): bool
    {
        return $tokens->isTokenKindFound(T_DOUBLE_COLON);
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
        return str_ends_with($file->getFilename(), '.php') && ! str_ends_with($file->getFilename(), '.blade.php');
    }

    public function fix(SplFileInfo $file, Tokens $tokens): void
    {
        $source = $tokens->generateCode();
        $aliases = ['\\illuminate\\support\\facades\\gate'];

        if (preg_match_all('/\buse\s+\\\\?Illuminate\\\\Support\\\\Facades\\\\Gate(?:\s+as\s+(\w+))?\s*;/i', $source, $imports, PREG_SET_ORDER)) {
            foreach ($imports as $import) {
                $aliases[] = strtolower($import[1] ?? 'Gate');
            }
        }

        preg_match('/\r\n|\n|\r/', $source, $matches);
        $newline = $matches[0] ?? "\n";

        for ($index = count($tokens) - 1; $index >= 0; $index--) {
            if (strtolower($tokens[$index]->getContent()) !== 'authorize') {
                continue;
            }

            $operator = $tokens->getPrevMeaningfulToken($index);
            $class = $operator === null ? null : $tokens->getPrevMeaningfulToken($operator);
            $open = $tokens->getNextMeaningfulToken($index);

            if ($operator === null || ! $tokens[$operator]->isGivenKind(T_DOUBLE_COLON) || $class === null
                || ! in_array(strtolower($tokens[$class]->getContent()), $aliases, true)
                || $open === null || ! $tokens[$open]->equals('(')) {
                continue;
            }

            $before = $tokens->getPrevMeaningfulToken($class);
            if ($before !== null && ! $tokens[$before]->equalsAny([';', '{', '}'])) {
                continue;
            }

            $close = $tokens->findBlockEnd(Tokens::BLOCK_TYPE_PARENTHESIS, $open);
            $end = $tokens->getNextMeaningfulToken($close);
            if ($end === null || ! $tokens[$end]->equals(';')) {
                continue;
            }

            $next = $end + 1;
            $whitespace = isset($tokens[$next]) && $tokens[$next]->isWhitespace() ? $tokens[$next]->getContent() : '';
            $comment = $whitespace === '' ? $next : $next + 1;
            if (isset($tokens[$comment]) && $tokens[$comment]->isGivenKind([T_COMMENT, T_DOC_COMMENT])
                && ! str_contains($whitespace, "\n") && ! str_contains($whitespace, "\r")) {
                $next = $comment + 1;
                $whitespace = isset($tokens[$next]) && $tokens[$next]->isWhitespace() ? $tokens[$next]->getContent() : '';
            }

            if (preg_match_all('/\r\n|\n|\r/', $whitespace) >= 2) {
                continue;
            }

            if ($whitespace !== '') {
                $tokens[$next] = new Token([T_WHITESPACE, $newline.$whitespace]);
            } else {
                $tokens->insertAt($next, new Token([T_WHITESPACE, $newline.$newline]));
            }
        }
    }
}
