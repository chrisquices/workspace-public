<?php

namespace Database\Factories;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Transaction> */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        $uuid = (string) Str::uuid();
        $userId = UserFactory::new();
        $amount = '5';

        return [
            'uuid' => $uuid,
            'user_id' => $userId,
            'amount' => $amount,
        ];
    }
}
