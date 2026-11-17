<?php

namespace App\Services;

use App\Models\Generation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Collection;
use InvalidArgumentException;
use stdClass;

class UsageService
{

    /**
     * Group settled generations by completion day in UTC, including both boundary dates.
     * Credit spend includes ledger debits only; generations without a debit retain their provider cost.
     * Each row contains date, user_id, user_name, credit_spend, provider_cost, and profit.
     * Monetary totals are exact decimal strings calculated by PostgreSQL.
     *
     * @return Collection<int, stdClass>
     */
    public function getDailyUsage(CarbonImmutable $startDate, CarbonImmutable $endDate, ?int $userId = null): Collection
    {
        $start = $startDate->utc()->startOfDay();
        $end = $endDate->utc()->startOfDay();

        if ($start->isAfter($end)) {
            throw new InvalidArgumentException('The usage start date must not be after the end date.');
        }

        $usage = Generation::query()
            ->join('users', 'users.id', '=', 'generations.user_id')
            ->leftJoin('transactions', function (JoinClause $join): void {
                $join->on('transactions.generation_id', '=', 'generations.id')
                    ->where('transactions.amount', '<', 0);
            })
            ->whereIn('generations.status', ['succeeded', 'failed'])
            ->where('generations.completed_at', '>=', $start->toIso8601String())
            ->where('generations.completed_at', '<', $end->addDay()->toIso8601String())
            ->select(['generations.user_id', 'users.name as user_name'])
            ->selectRaw("(generations.completed_at AT TIME ZONE 'UTC')::date AS date")
            ->selectRaw('COALESCE(-SUM(transactions.amount), 0)::text AS credit_spend')
            ->selectRaw('SUM(generations.provider_cost)::text AS provider_cost')
            ->selectRaw('(COALESCE(-SUM(transactions.amount), 0) - SUM(generations.provider_cost))::text AS profit')
            ->groupBy('generations.user_id', 'users.name')
            ->groupByRaw("(generations.completed_at AT TIME ZONE 'UTC')::date")
            ->orderByDesc('date')
            ->orderBy('generations.user_id');

        if ($userId !== null) {
            $usage->where('generations.user_id', $userId);
        }

        return $usage->toBase()->get();
    }
}
