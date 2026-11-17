<?php

return [
    'api' => [
        'base_url' => env('PIXELFORGE_API_BASE_URL', 'https://pixelforge.promptedit.dev'),
        'version' => env('PIXELFORGE_API_VERSION', 'v1'),
        'key' => env('PIXELFORGE_API_KEY'),
        'webhook_secret' => env('PIXELFORGE_WEBHOOK_SECRET'),
    ],
    'sizes' => ['1024x1024', '1536x1024', '1024x1536'],
    'qualities' => ['low', 'medium', 'high'],
    'statuses' => ['queued', 'processing', 'succeeded', 'failed'],
    'token_types' => ['input_text_tokens', 'input_image_tokens', 'output_tokens', 'reasoning_tokens'],
];
