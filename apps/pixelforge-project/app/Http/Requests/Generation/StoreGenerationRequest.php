<?php

namespace App\Http\Requests\Generation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGenerationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        $submissionKey = ['required', 'uuid'];
        $prompt = ['required', 'string', 'max:4000'];
        $size = ['required', Rule::in(config('pixelforge.sizes'))];
        $quality = ['required', Rule::in(config('pixelforge.qualities'))];
        $referenceImages = ['sometimes', 'array', 'list', 'max:'.min(4, (int) config('pixel.uploads.max_files'))];
        $referenceImage = ['required', 'file', 'image', 'mimes:'.implode(',', config('pixel.supported_file_formats.image')), 'max:'.((int) config('pixel.uploads.max_size') / 1024)];

        return [
            'submissionKey' => $submissionKey,
            'prompt' => $prompt,
            'size' => $size,
            'quality' => $quality,
            'referenceImages' => $referenceImages,
            'referenceImages.*' => $referenceImage,
        ];
    }
}
