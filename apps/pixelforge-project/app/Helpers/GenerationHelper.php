<?php

namespace App\Helpers;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use InvalidArgumentException;

class GenerationHelper
{

    public static function utcTimestamp(?string $value): ?CarbonImmutable
    {
        return $value === null ? null : CarbonImmutable::parse($value)->utc();
    }

    /**
     * @param  array<string, mixed>  $pricing
     * @return array{currency: string, minCostUsd: string, maxCostUsd: string}
     */
    public static function estimate(array $pricing, string $prompt, string $size = '1024x1024', string $quality = 'medium', int $referenceImageCount = 0): array
    {
        $tokens = $pricing['tokens'];
        $charactersPerToken = $tokens['characters_per_text_token'];
        $referenceTokens = $tokens['per_reference_image'];
        $outputTokens = $tokens['output'][$quality][$size];
        $minReasoning = $tokens['reasoning'][$quality]['min'];
        $maxReasoning = $tokens['reasoning'][$quality]['max'];
        $variance = $tokens['text_token_variance'];

        $baseTextTokens = BigDecimal::of(mb_strlen($prompt, 'UTF-8'))->dividedBy($charactersPerToken, 0, RoundingMode::Ceiling);
        $minTextTokens = $baseTextTokens->multipliedBy(BigDecimal::of(1)->minus((string) $variance))->toScale(0, RoundingMode::Floor)->toInt();
        $maxTextTokens = $baseTextTokens->multipliedBy(BigDecimal::of(1)->plus((string) $variance))->toScale(0, RoundingMode::Ceiling)->toInt();
        $usage = [
            'input_image_tokens' => BigDecimal::of($referenceTokens)->multipliedBy($referenceImageCount)->toInt(),
            'output_tokens' => $outputTokens,
        ];

        $currency = 'usd';
        $minCostUsd = self::calculateCost($usage + [
            'input_text_tokens' => $minTextTokens,
            'reasoning_tokens' => $minReasoning,
        ], $pricing['rates']);
        $maxCostUsd = self::calculateCost($usage + [
            'input_text_tokens' => $maxTextTokens,
            'reasoning_tokens' => $maxReasoning,
        ], $pricing['rates']);

        return [
            'currency' => $currency,
            'minCostUsd' => $minCostUsd,
            'maxCostUsd' => $maxCostUsd,
        ];
    }

    /**
     * @param  array<string, mixed>  $usage
     * @param  array<string, string>  $rates
     */
    public static function calculateCost(array $usage, array $rates): string
    {
        $cost = BigDecimal::of(0);

        foreach (config('pixelforge.token_types') as $type) {
            $count = self::tokenCount($usage[$type] ?? null);
            $rate = $rates[$type] ?? null;

            $cost = $cost->plus(BigDecimal::of($rate)->multipliedBy($count));
        }

        return (string) $cost->dividedBy(1_000_000, 9);
    }

    private static function tokenCount(mixed $value): int
    {
        if (! is_int($value) || $value < 0) {
            throw new InvalidArgumentException('Pixelforge token counts must be nonnegative integers.');
        }

        return $value;
    }
}
