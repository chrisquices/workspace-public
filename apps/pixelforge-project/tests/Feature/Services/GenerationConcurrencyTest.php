<?php

use App\Services\TransactionService;
use Database\Factories\TransactionFactory;
use Database\Factories\UserFactory;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;

uses(DatabaseMigrations::class);

it('allows only one simultaneous request when the credits cannot cover both reservations', function () {
    $user = UserFactory::new()->create();
    TransactionFactory::new()->create([
        'user_id' => $user->id,
        'amount' => '0.1',
    ]);
    $database = config('database.connections.pgsql');
    $environment = [
        'APP_ENV' => 'testing',
        'DB_CONNECTION' => 'pgsql',
        'DB_DATABASE' => 'pixelforge_testing',
        'DB_URL' => '',
        'DB_HOST' => (string) $database['host'],
        'DB_PORT' => (string) $database['port'],
        'DB_USERNAME' => (string) $database['username'],
        'DB_PASSWORD' => (string) $database['password'],
        'CACHE_STORE' => 'array',
        'QUEUE_CONNECTION' => 'sync',
    ];
    $inputs = [new InputStream, new InputStream];
    $workers = [];
    DB::beginTransaction();
    try {
        DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
        foreach ($inputs as $input) {
            $worker = new Process([PHP_BINARY, base_path('tests/Fixtures/submit-generation-worker.php'), (string) $user->id], base_path(), $environment, $input, 20);
            $worker->start();
            $workers[] = $worker;
        }
        foreach ($workers as $worker) {
            $ready = $worker->waitUntil(function ($type, $output) {
                return str_contains($output, 'ready');
            });
            expect($ready)->toBeTrue($worker->getErrorOutput());
        }
        foreach ($inputs as $input) {
            $input->write("go\n");
            $input->close();
        }
        $deadline = microtime(true) + 5;
        do {
            foreach ($workers as $worker) {
                $worker->isRunning();
            }
            DB::select('SELECT pg_stat_clear_snapshot()');
            $waiting = DB::selectOne("SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'pixelforge-credit-concurrency' AND wait_event_type = 'Lock'")->total;
            if ((int) $waiting === 2) {
                break;
            }
            usleep(10000);
        } while (microtime(true) < $deadline);
        expect((int) $waiting)->toBe(2);
        DB::commit();

        $outcomes = [];
        foreach ($workers as $worker) {
            expect($worker->wait())->toBe(0, $worker->getErrorOutput());
            $outcomes[] = trim(str_replace("ready\n", '', $worker->getOutput()));
        }
        sort($outcomes);
        expect($outcomes)->toBe(['accepted:1', 'insufficient:0']);
        $this->assertDatabaseCount('generations', 1);
        $this->assertDatabaseCount('transactions', 1);
        expect(app(TransactionService::class)->getSpendableBalance($user->id))->toBe('0.013737500000');
    } finally {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        foreach ($workers as $worker) {
            if ($worker->isRunning()) {
                $worker->stop();
            }
        }
    }
});
