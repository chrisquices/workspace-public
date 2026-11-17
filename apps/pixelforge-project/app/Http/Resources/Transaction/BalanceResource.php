<?php

namespace App\Http\Resources\Transaction;

use App\Helpers\NumberHelper;
use Brick\Math\RoundingMode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BalanceResource extends JsonResource
{

    /** @return array{totalBalance: string, spendableBalance: string} */
    public function toArray(Request $request): array
    {
        $balance = $this->resource;

        $totalBalance = NumberHelper::formatNumberToCurrency(number: $balance['totalBalance'], decimals: 4, roundingMode: RoundingMode::Floor);
        $spendableBalance = NumberHelper::formatNumberToCurrency(number: $balance['spendableBalance'], decimals: 4, roundingMode: RoundingMode::Floor);

        return [
            'totalBalance' => $totalBalance,
            'spendableBalance' => $spendableBalance,
        ];
    }
}
