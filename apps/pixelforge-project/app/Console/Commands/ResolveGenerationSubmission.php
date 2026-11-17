<?php

namespace App\Console\Commands;

use App\Services\GenerationService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

#[Signature('generations:resolve-submission {uuid : Local generation UUID} {--confirmed-not-accepted : Confirm you verified that Pixelforge never accepted this submission}')]
#[Description('Release credits for a manually verified, unaccepted submission')]
class ResolveGenerationSubmission extends Command
{
    public function __construct(private readonly GenerationService $generationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! $this->option('confirmed-not-accepted')) {
            $this->error('Verify that Pixelforge never accepted this submission, then pass --confirmed-not-accepted. A timeout or missing webhook is not confirmation.');

            return self::FAILURE;
        }

        try {
            $this->generationService->resolveUncertainSubmission((string) $this->argument('uuid'));
        } catch (ValidationException $exception) {
            $this->error($exception->validator->errors()->first());

            return self::FAILURE;
        }

        $this->info('Submission marked failed; reserved credits released without a charge.');

        return self::SUCCESS;
    }
}
