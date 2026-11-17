<?php

namespace App\Http\Controllers;

use App\Http\Requests\Transaction\StoreTransactionRequest;
use App\Services\TransactionService;
use Illuminate\Http\RedirectResponse;

class TransactionController extends Controller
{
    public function __construct(private readonly TransactionService $transactionService) {}

    public function store(StoreTransactionRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $this->transactionService->store(userId: $user->id, transactionKey: $data['transactionKey']);

        return to_route('generations.index');
    }
}
