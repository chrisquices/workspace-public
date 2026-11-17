<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Resources\Error\ErrorStatusResource;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->preventRequestForgery(except: ['webhooks/pixelforge']);

        $middleware->redirectGuestsTo(function (): string {
            return route('login.index');
        });

        $middleware->redirectUsersTo(function (): string {
            return route('generations.index');
        });

        $middleware->web(append: [HandleInertiaRequests::class, AddLinkHeadersForPreloadedAssets::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (Request $request): bool {
            return $request->is('api/*', 'webhooks/pixelforge') || $request->expectsJson();
        });

        $exceptions->respond(function (Response $response, Throwable $exception, Request $request): Response {
            $status = $response->getStatusCode();

            if ($request->is('api/*', 'webhooks/pixelforge') || $request->expectsJson() || ($status !== 400 && $status !== 404 && $status !== 405 && ($status < 500 || $status >= 600))) {
                return $response;
            }

            $page = match ($status) {
                400 => 'Errors/BadRequest',
                404 => 'Errors/NotFound',
                405 => 'Errors/MethodNotAllowed',
                default => 'Errors/ServerError',
            };

            $errorStatus = ErrorStatusResource::make($status)->resolve($request);
            $status = $errorStatus['status'];
            $errorResponse = Inertia::render($page, [
                'status' => $status,
            ])
                ->toResponse($request)
                ->setStatusCode($status);

            if ($response->headers->has('Retry-After')) {
                $errorResponse->headers->set('Retry-After', $response->headers->get('Retry-After'));
            }

            if ($response->headers->has('Allow')) {
                $errorResponse->headers->set('Allow', $response->headers->get('Allow'));
            }

            return $errorResponse;
        });
    })->create();
