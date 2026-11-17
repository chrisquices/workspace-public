<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\Register\SubmitRegisterRequest;
use App\Services\UserService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    public function __construct(private UserService $userService) {}

    public function index(): Response
    {
        return Inertia::render(component: 'Auth/Register', props: []);
    }

    public function submit(SubmitRegisterRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $user = $this->userService->createUser(name: $validated['name'], email: $validated['email'], password: $validated['password']);

        event(new Registered($user));
        Auth::login(user: $user);
        $request->session()->regenerate();

        return redirect()->route(route: 'generations.index');
    }
}
