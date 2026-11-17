<?php

namespace App\Services;

use App\Models\Generation;
use App\Models\Transaction;
use App\Models\User;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;

class TransactionService
{

    public function getTotalBalance(int $userId): string
    {
        $balance = Transaction::query()
            ->where('user_id', $userId)
            ->sum('amount');

        if (is_float($balance)) {
            throw new LogicException('Credit balances must use exact decimal values.');
        }

        return (string) BigDecimal::of($balance)->toScale(12);
    }

    public function getSpendableBalance(int $userId): string
    {
        $reservedAmount = Generation::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['pending', 'queued', 'processing'])
            ->sum('reserved_amount');

        if (is_float($reservedAmount)) {
            throw new LogicException('Reserved amounts must use exact decimal values.');
        }

        $totalBalanceRaw = $this->getTotalBalance($userId);

        return (string) BigDecimal::of($totalBalanceRaw)->minus($reservedAmount)->toScale(12);
    }

    public function ensureCanGenerate(int $userId, string $estimatedCost): void
    {
        $spendableBalanceRaw = $this->getSpendableBalance($userId);

        if (BigDecimal::of($spendableBalanceRaw)->isLessThan($estimatedCost)) {
            throw ValidationException::withMessages([
                'credits' => 'Insufficient credits.',
            ]);
        }
    }

    public function settleGeneration(int $generationId): void
    {
        DB::transaction(function () use ($generationId): void {
            $generation = Generation::query()
                ->whereKey($generationId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($generation->status, ['succeeded', 'failed'], true) || $generation->actual_cost === null) {
                throw new LogicException('Only completed generations with a final cost can be settled.');
            }

            if (BigDecimal::of($generation->reserved_amount)->isZero()) {
                return;
            }

            User::query()
                ->whereKey($generation->user_id)
                ->lockForUpdate()
                ->firstOrFail();

            $actualCost = BigDecimal::of($generation->actual_cost);

            if ($generation->status === 'succeeded' && $actualCost->isGreaterThan('0')) {
                $amount = (string) $actualCost->negated();
                $transaction = Transaction::query()
                    ->firstOrCreate([
                        'generation_id' => $generation->id,
                    ], [
                        'uuid' => (string) Str::uuid(),
                        'user_id' => $generation->user_id,
                        'amount' => $amount,
                    ]);

                if ($transaction->user_id !== $generation->user_id || ! BigDecimal::of($transaction->amount)->isEqualTo($amount)) {
                    throw new LogicException('This generation already has a different ledger charge.');
                }
            }

            $generation->update([
                'reserved_amount' => '0',
            ]);
        });
    }

    public function store(int $userId, string $transactionKey): void
    {
        DB::transaction(function () use ($userId, $transactionKey): void {
            User::query()
                ->whereKey($userId)
                ->lockForUpdate()
                ->firstOrFail();

            $transaction = Transaction::query()
                ->firstOrCreate([
                    'uuid' => $transactionKey,
                ], [
                    'user_id' => $userId,
                    'amount' => '5',
                ]);

            if ($transaction->user_id !== $userId || $transaction->generation_id !== null || ! BigDecimal::of($transaction->amount)->isEqualTo('5')) {
                throw ValidationException::withMessages([
                    'transactionKey' => 'We couldn’t complete your purchase. Please refresh the page and try again.',
                ]);
            }
        });
    }
}
