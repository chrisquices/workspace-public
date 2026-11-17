<?php

namespace App\Helpers;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

class NumberHelper
{

    /** @param int<0, max> $decimals */
    public static function formatNumberWithSeparators(int|float|string $number, int $decimals = 0, RoundingMode $roundingMode = RoundingMode::HalfUp): string
    {
        $formattedNumber = (string) BigDecimal::of((string) $number)->toScale($decimals, $roundingMode);
        [$integer, $fraction] = array_pad(explode('.', $formattedNumber, 2), 2, '');
        $integer = preg_replace('/\B(?=(\d{3})+(?!\d))/', ',', $integer);

        return $integer.($decimals > 0 ? '.'.$fraction : '');
    }

    /**
     * Pass exact decimal strings for money; float inputs may already have lost precision.
     *
     * @param  int<0, max>|null  $decimals
     */
    public static function formatNumberToCurrency(int|float|string $number, string $currencyCode = 'USD', ?int $decimals = null, RoundingMode $roundingMode = RoundingMode::HalfUp): string
    {
        $currencyCode = strtoupper($currencyCode);
        $currency = config("currencies.$currencyCode", []);
        $thousandsSeparator = $currency['thousands_separator'] ?? ',';
        $decimalSeparator = $currency['decimal_separator'] ?? '.';
        $decimalPoints = $decimals ?? $currency['decimal_points'] ?? 2;
        $symbol = $currency['symbol'] ?? ($currencyCode === 'USD' ? '$' : $currencyCode.' ');
        $amount = BigDecimal::of((string) $number)->toScale($decimalPoints, $roundingMode);
        $formattedNumber = self::formatNumberWithSeparators((string) $amount->abs(), $decimalPoints);
        $formattedNumber = strtr($formattedNumber, [
            ',' => $thousandsSeparator,
            '.' => $decimalSeparator,
        ]);

        return ($amount->isNegative() ? '-' : '').$symbol.$formattedNumber;
    }
}
