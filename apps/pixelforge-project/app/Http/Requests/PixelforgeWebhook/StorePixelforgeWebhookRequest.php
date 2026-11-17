<?php

namespace App\Http\Requests\PixelforgeWebhook;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePixelforgeWebhookRequest extends FormRequest
{
    public function authorize(): bool
    {
        $secret = config('pixelforge.api.webhook_secret');
        abort_unless(is_string($secret) && trim($secret) !== '', 503, 'Webhook signing secret is not configured.');

        $signature = (string) $this->header('Pixelforge-Signature');
        if (! preg_match('/\At=([0-9]{1,12}),v1=([a-f0-9]{64})\z/', $signature, $matches)) {
            return false;
        }

        if (abs(time() - (int) $matches[1]) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $matches[1].'.'.$this->getContent(), $secret);

        return hash_equals($expected, $matches[2]);
    }

    /** @return array<string, mixed> */
    public function validationData(): array
    {
        return $this->json()->all();
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        $rules = [
            'id' => ['required', 'string', 'max:255', 'regex:/\Aevt_[a-zA-Z0-9]+\z/'],
            'object' => ['required', Rule::in(['event'])],
            'type' => ['required', Rule::in(['ping', 'generation.processing', 'generation.succeeded', 'generation.failed'])],
            'created_at' => ['required', 'date'],
        ];

        $type = $this->json('type');
        if ($type === 'ping' || ! is_string($type)) {
            return $rules;
        }

        $rules += [
            'data' => ['required', 'array'],
            'data.object' => ['required', 'array'],
            'data.object.id' => ['required', 'string', 'max:255', 'regex:/\Agen_[a-zA-Z0-9]+\z/'],
            'data.object.object' => ['required', Rule::in(['generation'])],
            'data.object.status' => ['required', Rule::in([substr($type, strlen('generation.'))])],
            'data.object.metadata' => ['sometimes', 'array'],
            'data.object.metadata.generation_uuid' => ['sometimes', 'uuid'],
            'data.object.created_at' => ['required', 'date'],
            'data.object.started_at' => ['nullable', 'date'],
            'data.object.completed_at' => ['required_unless:data.object.status,processing', 'nullable', 'date'],
            'data.object.rates' => ['required', 'array'],
        ];

        foreach (config('pixelforge.token_types') as $tokenType) {
            $rules['data.object.rates.'.$tokenType] = ['required', 'string', 'regex:/\A[0-9]+(?:\.[0-9]+)?\z/'];
        }

        if ($type === 'generation.succeeded') {
            $rules['data.object.image_url'] = ['required', 'url:https'];
            $rules['data.object.image_url_expires_at'] = ['required', 'date'];
            $rules['data.object.usage'] = ['required', 'array'];

            foreach (config('pixelforge.token_types') as $tokenType) {
                $rules['data.object.usage.'.$tokenType] = ['required', 'integer:strict', 'min:0'];
            }
        }

        if ($type === 'generation.failed') {
            $rules['data.object.error'] = ['required', 'array'];
            $rules['data.object.error.code'] = ['required', 'string', 'max:255'];
        }

        return $rules;
    }
}
