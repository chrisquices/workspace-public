<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\Login\SubmitLoginRequest;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class LoginController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->session()->get(key: 'status');

        return Inertia::render(component: 'Auth/Login', props: [
            'status' => $status,
        ]);
    }

    public function submit(SubmitLoginRequest $request, AuthenticatedSessionController $controller): HttpResponse
    {
        $response = $controller->store(request: $request);

        return Router::toResponse(request: $request, response: $response);
    }
}
