<?php

namespace App\Console\Commands;

use App\Services\GenerationService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('generations:sync')]
#[Description('Sync Pixelforge generations without deleting local records')]
class SyncGenerations extends Command
{
    public function __construct(private readonly GenerationService $generationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {

        $this->generationService->syncGenerations();

        $this->info('Generations synced.');

        return self::SUCCESS;
    }
}
