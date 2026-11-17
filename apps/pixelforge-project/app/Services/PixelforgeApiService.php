<?php

namespace App\Services;

use App\Exceptions\PixelforgeApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use LogicException;
use Throwable;

class PixelforgeApiService
{

    /**
     * @param  list<string>  $referenceImages
     * @param  array<string, string>  $metadata
     * @return array<string, mixed>
     */
    public function createGeneration(string $idempotencyKey, string $prompt, string $size = '1024x1024', string $quality = 'medium', array $referenceImages = [], array $metadata = []): array
    {
        Validator::make(compact('idempotencyKey', 'prompt', 'size', 'quality', 'referenceImages', 'metadata'), [
            'idempotencyKey' => ['required', 'string', 'max:255', 'not_regex:/[\x00-\x1F\x7F]/'],
            'prompt' => ['required', 'string', 'max:4000'],
            'size' => ['required', Rule::in(config('pixelforge.sizes'))],
            'quality' => ['required', Rule::in(config('pixelforge.qualities'))],
            'referenceImages' => ['array', 'list', 'max:4'],
            'referenceImages.*' => ['required', 'string', 'url:http,https'],
            'metadata' => ['array', 'max:20'],
            'metadata.*' => ['present', 'string', 'max:500'],
        ])->validate();

        $generation = $this->request('POST', 'generations', 'generation', [
            'prompt' => $prompt,
            'size' => $size,
            'quality' => $quality,
            'reference_images' => $referenceImages,
            'metadata' => (object) $metadata,
        ], $idempotencyKey);

        $this->validateGeneration($generation);

        return $generation;
    }

    /** @return array<string, mixed> */
    public function getGeneration(string $id): array
    {
        Validator::make([
            'id' => $id,
        ], [
            'id' => ['required', 'regex:/\Agen_[a-zA-Z0-9]+\z/'],
        ])->validate();

        return $this->request('GET', 'generations/'.rawurlencode($id), 'generation');
    }

    /** @return array<string, mixed> */
    public function getPricing(): array
    {
        $pricing = $this->request('GET', 'pricing', 'pricing', authenticated: false);
        $this->validatePricing($pricing);

        return $pricing;
    }

    /** @return array<string, mixed> */
    public function getGenerations(?string $cursor = null): array
    {
        $page = $this->request('GET', 'generations', 'list', array_filter([
            'limit' => 100,
            'cursor' => $cursor,
        ], static function ($value): bool {
            return $value !== null;
        }));

        if (Validator::make($page, [
            'data' => ['present', 'array', 'list'],
            'data.*' => ['required', 'array'],
            'has_more' => ['required', 'boolean:strict'],
            'next_cursor' => ['required_if:has_more,true', 'nullable', 'string'],
        ])->fails()) {
            throw new PixelforgeApiException('invalid_response', retryable: true);
        }

        foreach ($page['data'] as $generation) {
            $this->validateGeneration($generation);
        }

        return $page;
    }

    /** @param array<string, mixed> $generation */
    private function validateGeneration(array $generation): void
    {
        $rules = [
            'id' => ['required', 'string', 'max:255', 'regex:/\Agen_[a-zA-Z0-9]+\z/'],
            'object' => ['required', Rule::in(['generation'])],
            'status' => ['required', Rule::in(config('pixelforge.statuses'))],
            'prompt' => ['required', 'string', 'max:4000'],
            'size' => ['required', Rule::in(config('pixelforge.sizes'))],
            'quality' => ['required', Rule::in(config('pixelforge.qualities'))],
            'reference_images' => ['present', 'array', 'list', 'max:4'],
            'reference_images.*' => ['required', 'url:http,https'],
            'metadata' => ['present', 'array'],
            'created_at' => ['required', 'date'],
            'started_at' => ['nullable', 'date'],
            'completed_at' => ['required_if:status,succeeded,failed', 'nullable', 'date'],
            'rates' => ['required', 'array'],
        ];

        foreach (config('pixelforge.token_types') as $tokenType) {
            $rules['rates.'.$tokenType] = ['required', 'string', 'regex:/\A[0-9]+(?:\.[0-9]+)?\z/'];
        }

        if (($generation['status'] ?? null) === 'succeeded') {
            $rules['image_url'] = ['required', 'url:https'];
            $rules['image_url_expires_at'] = ['required', 'date'];
            $rules['usage'] = ['required', 'array'];

            foreach (config('pixelforge.token_types') as $tokenType) {
                $rules['usage.'.$tokenType] = ['required', 'integer:strict', 'min:0'];
            }
        }

        if (($generation['status'] ?? null) === 'failed') {
            $rules['error.code'] = ['required', 'string', 'max:255'];
        }

        if (Validator::make($generation, $rules)->fails()) {
            throw new PixelforgeApiException('invalid_response', retryable: true);
        }
    }

    /** @param array<string, mixed> $pricing */
    private function validatePricing(array $pricing): void
    {
        $rules = [
            'currency' => ['required', Rule::in(['usd'])],
            'unit' => ['required', Rule::in(['per_1m_tokens'])],
            'rates' => ['required', 'array'],
            'tokens' => ['required', 'array'],
            'tokens.characters_per_text_token' => ['required', 'integer:strict', 'min:1'],
            'tokens.per_reference_image' => ['required', 'integer:strict', 'min:0'],
            'tokens.text_token_variance' => ['required', 'numeric', 'between:0,1'],
            'tokens.output' => ['required', 'array'],
            'tokens.reasoning' => ['required', 'array'],
        ];

        foreach (config('pixelforge.token_types') as $tokenType) {
            $rules['rates.'.$tokenType] = ['required', 'string', 'regex:/\A[0-9]+(?:\.[0-9]+)?\z/'];
        }

        foreach (config('pixelforge.qualities') as $quality) {
            $rules['tokens.output.'.$quality] = ['required', 'array'];
            $rules['tokens.reasoning.'.$quality] = ['required', 'array'];
            $rules['tokens.reasoning.'.$quality.'.min'] = ['required', 'integer:strict', 'min:0'];
            $rules['tokens.reasoning.'.$quality.'.max'] = ['required', 'integer:strict', 'min:0', 'gte:tokens.reasoning.'.$quality.'.min'];

            foreach (config('pixelforge.sizes') as $size) {
                $rules['tokens.output.'.$quality.'.'.$size] = ['required', 'integer:strict', 'min:0'];
            }
        }

        if (Validator::make($pricing, $rules)->fails()) {
            throw new PixelforgeApiException('invalid_response', retryable: true);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, string $object, array $data = [], ?string $idempotencyKey = null, bool $authenticated = true): array
    {
        $baseUrl = rtrim((string) config('pixelforge.api.base_url'), '/');
        $version = (string) config('pixelforge.api.version');

        if (! filter_var($baseUrl, FILTER_VALIDATE_URL)
            || parse_url($baseUrl, PHP_URL_SCHEME) !== 'https'
            || parse_url($baseUrl, PHP_URL_USER) !== null
            || parse_url($baseUrl, PHP_URL_PASS) !== null
            || parse_url($baseUrl, PHP_URL_QUERY) !== null
            || parse_url($baseUrl, PHP_URL_FRAGMENT) !== null
            || ! preg_match('/\Av[0-9]+\z/', $version)) {
            throw new LogicException('Configure a valid HTTPS Pixelforge base URL and API version.');
        }

        $mayHaveBeenAccepted = false;
        $request = Http::baseUrl($baseUrl.'/'.$version)
            ->acceptJson()
            ->asJson()
            ->withoutRedirecting()
            ->connectTimeout(3)
            ->timeout(15)
            ->retry(times: 3, sleepMilliseconds: function (int $attempt, Throwable $exception): int {
                $retryAfter = $exception instanceof RequestException
                    ? PixelforgeApiException::fromResponse($exception->response)->retryAfter : null;

                return max(250, ($retryAfter ?? 0) * 1000) * (2 ** ($attempt - 1));
            }, when: function (?Throwable $exception) use (&$mayHaveBeenAccepted, $method): bool {
                if ($exception instanceof ConnectionException) {
                    $mayHaveBeenAccepted = $method === 'POST';

                    return true;
                }

                if (! $exception instanceof RequestException) {
                    return false;
                }

                $failure = PixelforgeApiException::fromResponse($exception->response);
                if ($method === 'POST' && $exception->response->serverError() && $failure->errorCode !== 'overloaded') {
                    $mayHaveBeenAccepted = true;
                }

                return $failure->retryable && ($failure->retryAfter ?? 0) <= 5;
            }, throw: false, );

        if ($authenticated) {
            $key = config('pixelforge.api.key');

            if (! is_string($key) || trim($key) === '' || preg_match('/[\x00-\x20\x7F]/', $key)) {
                throw new LogicException('Configure PIXELFORGE_API_KEY before calling authenticated endpoints.');
            }

            $request->withToken($key);
        }

        if ($idempotencyKey !== null) {
            $request->withHeaders([
                'Idempotency-Key' => $idempotencyKey,
            ]);
        }

        try {
            $response = $request->send($method, $path, [
                $method === 'GET' ? 'query' : 'json' => $data,
            ]);
        } catch (ConnectionException) {
            throw new PixelforgeApiException('connection_failed', retryable: true, mayHaveBeenAccepted: $method === 'POST');
        }

        if ($response->status() !== ($method === 'POST' ? 202 : 200)) {
            throw PixelforgeApiException::fromResponse($response, $mayHaveBeenAccepted);
        }

        $body = $response->json();

        if (! is_array($body) || ($body['object'] ?? null) !== $object) {
            throw new PixelforgeApiException('invalid_response', $response->status(), retryable: true, mayHaveBeenAccepted: $method === 'POST');
        }

        return $body;
    }
}
