<?php

namespace App\Http\Requests\Usage;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class IndexUsageRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null;
    }

    /** @return array<string, mixed> */
    public function validationData(): array
    {
        $today = CarbonImmutable::today('UTC');
        $startDate = $today->subDays(29)->toDateString();
        $endDate = $today->toDateString();
        $userId = null;
        $sortBy = 'date';
        $sortDirection = 'desc';

        return [
            'startDate' => $startDate,
            'endDate' => $endDate,
            'userId' => $userId,
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            ...parent::validationData(),
        ];
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        $startDate = ['bail', 'required', 'string', 'date_format:Y-m-d'];
        $endDate = ['bail', 'required', 'string', 'date_format:Y-m-d', 'after_or_equal:startDate'];
        $userId = ['bail', 'nullable', 'integer', 'min:1', 'exists:users,id'];
        $sortBy = ['required', 'string', 'in:date,userName,creditSpend,providerCost,profit'];
        $sortDirection = ['required', 'string', 'in:asc,desc'];

        return [
            'startDate' => $startDate,
            'endDate' => $endDate,
            'userId' => $userId,
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
        ];
    }

    /** @return list<Closure(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->hasAny(['startDate', 'endDate'])) {
                    return;
                }

                $data = $validator->getData();
                $startDate = CarbonImmutable::parse($data['startDate'], 'UTC');
                $endDate = CarbonImmutable::parse($data['endDate'], 'UTC');

                if ($endDate->isAfter($startDate->addDays(91))) {
                    $validator->errors()->add('endDate', 'The date range must not exceed 92 days, including the start and end dates.');
                }
            },
        ];
    }
}
