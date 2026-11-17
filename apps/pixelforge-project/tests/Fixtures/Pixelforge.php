<?php

namespace Tests\Fixtures;

use App\Models\Generation;
use Illuminate\Support\Str;

class Pixelforge
{
    public static function rates(): array
    {
        return [
            'input_text_tokens' => '5.00',
            'input_image_tokens' => '10.00',
            'output_tokens' => '40.00',
            'reasoning_tokens' => '12.50',
        ];
    }

    public static function pricing(): array
    {
        return [
            'object' => 'pricing',
            'currency' => 'usd',
            'unit' => 'per_1m_tokens',
            'rates' => self::rates(),
            'tokens' => [
                'characters_per_text_token' => 4,
                'per_reference_image' => 765,
                'text_token_variance' => 0.15,
                'output' => [
                    'low' => [
                        '1024x1024' => 280,
                        '1024x1536' => 420,
                        '1536x1024' => 420,
                    ],
                    'medium' => [
                        '1024x1024' => 1100,
                        '1024x1536' => 1650,
                        '1536x1024' => 1650,
                    ],
                    'high' => [
                        '1024x1024' => 4300,
                        '1024x1536' => 6450,
                        '1536x1024' => 6450,
                    ],
                ],
                'reasoning' => [
                    'low' => [
                        'min' => 0,
                        'max' => 500,
                    ],
                    'medium' => [
                        'min' => 200,
                        'max' => 2000,
                    ],
                    'high' => [
                        'min' => 1000,
                        'max' => 8000,
                    ],
                ],
            ],
        ];
    }

    public static function submission(array $overrides = []): array
    {
        return array_replace([
            'submissionKey' => (string) Str::uuid(),
            'prompt' => 'tree',
            'size' => '1024x1024',
            'quality' => 'medium',
            'referenceImages' => [],
        ], $overrides);
    }

    public static function generation(Generation $generation, string $status = 'succeeded', array $overrides = []): array
    {
        return array_replace([
            'id' => $generation->provider_generation_id ?? 'gen_'.str_replace('-', '', $generation->uuid),
            'object' => 'generation',
            'status' => $status,
            'prompt' => $generation->prompt,
            'size' => $generation->size,
            'quality' => $generation->quality,
            'reference_images' => [],
            'metadata' => [
                'generation_uuid' => $generation->uuid,
            ],
            'rates' => self::rates(),
            'created_at' => '2026-11-17T23:58:00Z',
            'started_at' => '2026-11-17T23:59:00Z',
            'completed_at' => in_array($status, ['succeeded', 'failed'], true) ? '2026-11-17T23:59:59Z' : null,
            'usage' => [
                'input_text_tokens' => 10,
                'input_image_tokens' => 765,
                'output_tokens' => 1100,
                'reasoning_tokens' => 1000,
            ],
            'image_url' => 'https://provider.test/image.png',
            'image_url_expires_at' => '2026-11-18T23:59:59Z',
            'error' => [
                'code' => 'generation_failed',
            ],
        ], $overrides);
    }

    public static function event(array $generation, ?string $eventId = null): array
    {
        return [
            'id' => $eventId ?? 'evt_'.str_replace('-', '', (string) Str::uuid()),
            'object' => 'event',
            'type' => 'generation.'.$generation['status'],
            'created_at' => '2026-11-18T00:00:00Z',
            'data' => [
                'object' => $generation,
            ],
        ];
    }

    public static function signature(string $body, int $offset = 0, string $secret = 'test-webhook-secret'): string
    {
        $timestamp = time() + $offset;

        return 't='.$timestamp.',v1='.hash_hmac('sha256', $timestamp.'.'.$body, $secret);
    }

    public static function page(array $generations, ?string $nextCursor = null): array
    {
        return [
            'object' => 'list',
            'data' => $generations,
            'has_more' => $nextCursor !== null,
            'next_cursor' => $nextCursor,
        ];
    }
}
