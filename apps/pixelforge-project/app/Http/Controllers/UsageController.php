<?php

namespace App\Http\Controllers;

use App\Http\Requests\Usage\IndexUsageRequest;
use App\Http\Resources\Usage\UserUsageResource;
use App\Http\Resources\User\UserOptionResource;
use App\Services\UsageService;
use App\Services\UserService;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class UsageController extends Controller
{
    public function __construct(private readonly UsageService $usageService, private readonly UserService $userService) {}

    public function index(IndexUsageRequest $request): Response
    {
        $filters = $request->validated();
        $startDate = CarbonImmutable::parse(time: $filters['startDate'], timezone: 'UTC');
        $endDate = CarbonImmutable::parse(time: $filters['endDate'], timezone: 'UTC');
        $userId = $filters['userId'] !== null ? (int) $filters['userId'] : null;
        $filters['userId'] = $userId;

        $dailyUsageRaw = $this->usageService->getDailyUsage(startDate: $startDate, endDate: $endDate, userId: $userId);
        $usages = UserUsageResource::collection(resource: $dailyUsageRaw)->resolve(request: $request);

        $usersRaw = $this->userService->getUsers();
        $users = UserOptionResource::collection(resource: $usersRaw)->resolve(request: $request);

        return Inertia::render(component: 'Usages/Index', props: [
            'filters' => $filters,
            'usages' => $usages,
            'users' => $users,
        ]);
    }
}
