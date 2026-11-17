<?php

namespace App\Http\Middleware;

use App\Http\Resources\Config\ConfigResource;
use App\Http\Resources\Transaction\BalanceResource;
use App\Http\Resources\User\UserResource;
use App\Services\TransactionService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{

    /** @var string */
    protected $rootView = 'app';

    public function __construct(private readonly TransactionService $transactionService) {}

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        $user = $request->user();

        $configRaw = config('pixel');
        $config = ConfigResource::make(resource: $configRaw)->resolve(request: $request);

        $name = config('app.name');
        $auth = [
            'user' => $user === null ? null : UserResource::make($user)->resolve($request),
        ];

        $balance = function () use ($request, $user): ?array {
            if ($user === null) {
                return null;
            }

            $totalBalanceRaw = $this->transactionService->getTotalBalance(userId: $user->id);
            $spendableBalanceRaw = $this->transactionService->getSpendableBalance(userId: $user->id);

            $balanceRaw = [
                'totalBalance' => $totalBalanceRaw,
                'spendableBalance' => $spendableBalanceRaw,
            ];

            return BalanceResource::make(resource: $balanceRaw)->resolve(request: $request);
        };

        return [
            ...parent::share($request),
            'config' => $config,
            'name' => $name,
            'auth' => $auth,
            'balance' => $balance,
        ];
    }
}
