<?php

namespace App\Http\Requests\Generation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EstimateGenerationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null;
    }

    /**
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        $prompt = ['required', 'string', 'max:4000'];
        $size = ['required', Rule::in(config('pixelforge.sizes'))];
        $quality = ['required', Rule::in(config('pixelforge.qualities'))];
        $referenceImageCount = ['required', 'integer', 'between:0,4'];

        return [
            'prompt' => $prompt,
            'size' => $size,
            'quality' => $quality,
            'referenceImageCount' => $referenceImageCount,
        ];
    }
}
