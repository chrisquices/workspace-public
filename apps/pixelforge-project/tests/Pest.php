<?php

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');
pest()->use(LazilyRefreshDatabase::class)->in('Feature/Http', 'Feature/Console', 'Feature/Jobs');
