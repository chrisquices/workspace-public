<?php

use App\Jobs\SubmitGenerationJob;
use App\Services\GenerationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Fixtures\Pixelforge;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || config('database.connections.pgsql.database') !== 'pixelforge_testing' || config('database.connections.pgsql.url')) {
    throw new LogicException('Concurrency worker requires the dedicated test database.');
}
config([
    'pixelforge.api.base_url' => 'https://provider.test',
    'pixelforge.api.key' => 'test-api-key',
    'logging.default' => 'null',
]);
DB::statement("SET application_name = 'pixelforge-credit-concurrency'");
Http::preventStrayRequests();
Http::fake([
    'https://provider.test/v1/pricing' => function () {
        fwrite(STDOUT, "ready\n");
        fflush(STDOUT);
        if (fgets(STDIN) !== "go\n") {
            throw new LogicException('Concurrency barrier was not released.');
        }

        return Http::response(Pixelforge::pricing());
    },
]);
Queue::fake();
try {
    app(GenerationService::class)->storeGeneration((int) $argv[1], (string) Str::uuid(), 'tree', '1024x1024', 'medium');
    echo 'accepted:'.Queue::pushed(SubmitGenerationJob::class)->count()."\n";
} catch (ValidationException $exception) {
    if (! isset($exception->errors()['credits'])) {
        throw $exception;
    }
    echo 'insufficient:'.Queue::pushed(SubmitGenerationJob::class)->count()."\n";
}
