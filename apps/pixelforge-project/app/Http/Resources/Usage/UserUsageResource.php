<?php

namespace App\Http\Resources\Usage;

use App\Helpers\NumberHelper;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserUsageResource extends JsonResource
{

    /**
     * @return array{date: string, dateFormatted: string, userId: int, userName: string, creditSpend: string, creditSpendFormatted: string, providerCost: string, providerCostFormatted: string, profit: string, profitFormatted: string}
     */
    public function toArray(Request $request): array
    {
        $usage = $this->resource;

        $date = $usage->date;
        $dateFormatted = CarbonImmutable::parse($date, 'UTC')->format('M j, Y');
        $userId = $usage->user_id;
        $userName = $usage->user_name;
        $creditSpend = $usage->credit_spend;
        $creditSpendFormatted = NumberHelper::formatNumberToCurrency(number: $creditSpend, decimals: 4);
        $providerCost = $usage->provider_cost;
        $providerCostFormatted = NumberHelper::formatNumberToCurrency(number: $providerCost, decimals: 4);
        $profit = $usage->profit;
        $profitFormatted = NumberHelper::formatNumberToCurrency(number: $profit, decimals: 4);

        return [
            'date' => $date,
            'dateFormatted' => $dateFormatted,
            'userId' => $userId,
            'userName' => $userName,
            'creditSpend' => $creditSpend,
            'creditSpendFormatted' => $creditSpendFormatted,
            'providerCost' => $providerCost,
            'providerCostFormatted' => $providerCostFormatted,
            'profit' => $profit,
            'profitFormatted' => $profitFormatted,
        ];
    }
}
