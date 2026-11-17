<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;
use LogicException;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();

        if (! $app->environment('testing')
            || config('database.default') !== 'pgsql'
            || config('database.connections.pgsql.database') !== 'pixelforge_testing'
            || config('database.connections.pgsql.url')) {
            throw new LogicException('Tests may only run against the dedicated pixelforge_testing PostgreSQL database.');
        }

        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'app.url' => 'https://pixel.test',
            'logging.default' => 'null',
            'inertia.ssr.enabled' => false,
            'pixelforge.api.base_url' => 'https://provider.test',
            'pixelforge.api.key' => 'test-api-key',
            'pixelforge.api.webhook_secret' => 'test-webhook-secret',
        ]);

        Http::preventStrayRequests();

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }
}
