<?php

namespace App\Http\Requests\Transaction;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        $transactionKey = ['required', 'uuid'];

        return [
            'transactionKey' => $transactionKey,
        ];
    }
}
