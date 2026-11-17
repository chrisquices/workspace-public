<?php

namespace App\Http\Requests\Generation;

use Illuminate\Foundation\Http\FormRequest;

class IndexGenerationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        $search = ['nullable', 'string', 'max:255'];
        $sortBy = ['sometimes', 'required', 'string', 'in:prompt,created_at'];
        $sortDirection = ['sometimes', 'required', 'string', 'in:asc,desc'];

        return [
            'search' => $search,
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
        ];
    }
}
