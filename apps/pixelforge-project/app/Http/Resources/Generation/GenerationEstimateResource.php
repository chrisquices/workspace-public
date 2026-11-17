<?php

namespace App\Http\Resources\Generation;

use App\Helpers\NumberHelper;
use Brick\Math\RoundingMode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GenerationEstimateResource extends JsonResource
{

    /** @return array{currency: string, minPriceUsd: string, minPriceUsdFormatted: string, maxPriceUsd: string, maxPriceUsdFormatted: string} */
    public function toArray(Request $request): array
    {
        $generationEstimate = $this->resource;

        $currency = $generationEstimate['currency'];

        $minPriceUsd = $generationEstimate['minPriceUsd'];
        $minPriceUsdFormatted = NumberHelper::formatNumberToCurrency(number: $minPriceUsd, currencyCode: $currency, decimals: 4, roundingMode: RoundingMode::Floor);

        $maxPriceUsd = $generationEstimate['maxPriceUsd'];
        $maxPriceUsdFormatted = NumberHelper::formatNumberToCurrency(number: $maxPriceUsd, currencyCode: $currency, decimals: 4, roundingMode: RoundingMode::Ceiling);

        return [
            'currency' => $currency,
            'minPriceUsd' => $minPriceUsd,
            'minPriceUsdFormatted' => $minPriceUsdFormatted,
            'maxPriceUsd' => $maxPriceUsd,
            'maxPriceUsdFormatted' => $maxPriceUsdFormatted,
        ];
    }
}
