# Laravel New Post-Install

This guide applies after a brand new Laravel installation, when the user asks the agent to complete setup for an application under `apps/` in the workspace monorepo.

Apply the setup below to the existing application. Preserve the user’s installer choices.

Do not create or recreate the application or run the Laravel installer.

## Starter Kit Cleanup

For a Vue starter kit, apply these steps relative to the application root. Remove all references to deleted items and their dependent implementations throughout the application.

- Delete the application-root files `.editorconfig`, `.gitattributes`, `.gitignore`, `.npmrc`, `components.json`, `phpstan.neon`, `pint.json`, and `pnpm-workspace.yaml`.
- Empty `database/factories/`, including `database/factories/UserFactory.php`, but keep `database/factories/`.
- Empty `resources/js/components/`, including `resources/js/components/ui/`, but keep `resources/js/components/`.
- Empty `resources/js/composables/`, but keep the directory.
- In `resources/js/layouts/`, keep or create only `resources/js/layouts/AppLayout.vue`, `resources/js/layouts/AuthLayout.vue`, and `resources/js/layouts/GuestLayout.vue`; delete everything else, including `resources/js/layouts/app/`, `resources/js/layouts/auth/`, and `resources/js/layouts/settings/`. Give each file an empty `<script setup lang="ts"></script>` and a `<template><slot /></template>`.
- Empty `resources/js/lib/`, but keep the directory.
- Preserve the files in `resources/js/pages/Auth/`, including `resources/js/pages/Auth/ForgotPassword.vue`, `resources/js/pages/Auth/Login.vue`, and `resources/js/pages/Auth/ResetPassword.vue`. Clear each Vue file's script and template, leaving only `<script setup lang="ts"></script>` and `<template></template>`.
- Delete `resources/js/pages/settings/`, `resources/js/pages/Dashboard.vue`, and `resources/js/pages/Welcome.vue`; create `resources/js/pages/Dashboard/Index.vue` with an empty `<script setup lang="ts"></script>` and `<template></template>`.
- Create `resources/js/pages/Home/Index.vue` with an empty `<script setup lang="ts"></script>` and `<template></template>`.
- Create `resources/js/pages/Errors/BadRequest.vue`, `resources/js/pages/Errors/NotFound.vue`, and `resources/js/pages/Errors/ServerError.vue`, each with an empty `<script setup lang="ts"></script>` and `<template></template>`.
- In `resources/js/app.ts`, register `AuthLayout` for `Auth/` pages, `GuestLayout` for `Errors/` pages, and `AppLayout` as the default.
- In `bootstrap/app.php`, render the corresponding Inertia error page for HTTP 400, 404, and 5xx responses, preserving the response status and leaving API and JSON responses unchanged.
- Remove the `routes/settings.php` inclusion from `routes/web.php`, then delete `routes/settings.php`.
- Create `app/Http/Controllers/DashboardController.php` with an `index()` method that returns `Inertia::render('Dashboard/Index')` without data. Route `/dashboard` to it in `routes/web.php`, preserving the existing route name and middleware.
- Create `app/Http/Controllers/HomeController.php` with an `index()` method that redirects authenticated users to the dashboard route using `to_route()` and returns `Inertia::render('Home/Index')` for guests. Route `/` to it in `routes/web.php` and name the route `home.index`.
- Create `app/Http/Controllers/Auth/LoginController.php`, `app/Http/Controllers/Auth/ForgotPasswordController.php`, and `app/Http/Controllers/Auth/ResetPasswordController.php`. Each controller must have an `index()` method that renders its corresponding page in `resources/js/pages/Auth/` and a `submit()` method that handles its form submission. Create their requests in controller-specific folders under `app/Http/Requests/Auth/` (for example, `app/Http/Requests/Auth/Login/`) and register the page and submission routes in `routes/web.php`, avoiding conflicts with Fortify routes and preserving authentication and password-reset behavior.
- Delete `app/Http/Controllers/Settings/`.
- Delete `app/Http/Requests/Settings/`.
- Delete `app/Http/Middleware/HandleAppearance.php`.
- Create `app/Http/Requests/Auth/ResetPassword/SubmitResetPasswordRequest.php` to authorize guests and validate the reset token, email, and confirmed password using `Password::default()`. Type-hint it in `ResetPasswordController::submit()` before delegating to Fortify, and remove password validation from `ResetUserPassword` while retaining persistence.
- Delete `app/Concerns/` and its contents, including `app/Concerns/ProfileValidationRules.php` and `app/Concerns/PasswordValidationRules.php`.
- Empty `tests/`, including its subdirectories, but keep `tests/`.

## Database Seeders

In `database/seeders/DatabaseSeeder.php`, replace the contents of `run()` with only `$this->call(UserSeeder::class);`.

Create `app/Services/UserService.php` with a `store()` method that accepts one argument per user column and inserts one user:

```php
<?php

namespace App\Services;

use App\Models\User;

class UserService
{
    public function store(string $name, string $email, string $password): void
    {
        User::query()->insertOrIgnore([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
```

Create `database/seeders/UserSeeder.php` with the following code. Check the users migration in `database/migrations/` and add any other required columns to the seeder and service.

```php
<?php

namespace Database\Seeders;

use App\Services\UserService;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name' => 'Default User',
                'email' => 'user@gmail.com',
                'password' => '$2y$12$RRNRvgEu6otXgxIDUt8IGeM6yCEaNub/0UZPGBDxmoUn8HO3sC04C',
            ],
        ];

        $userService = app(UserService::class);

        foreach ($users as $user) {
            $userService->store($user['name'], $user['email'], $user['password']);
        }
    }
}
```

## Workspace Setup

Invoke the [using-the-workspace](../skills/using-the-workspace/SKILL.md) skill and follow this reference specifically [setting-up-the-workspace](../skills/using-the-workspace/references/setting-up-the-workspace.md)

## Vite SSR with Shared UI Packages

When the application imports Vue components from `workspace-packages`, configure `vite.config.ts` so SSR uses the application's Vue and Reka UI instances:

```ts
resolve: {
    dedupe: ['vue', '@inertiajs/vue3', '@inertiajs/core', 'reka-ui'],
},

ssr: {
    noExternal: ['workspace-packages'],
},
```

Restart the Vite development server after changing this configuration.

## Laravel Boost

If Laravel Boost is not already installed, install it in the application:

```sh
composer require --dev laravel/boost
```

Keep MCP configuration and skills application-local.

Then run:

```sh
php artisan boost:install
```

After installation, delete the application-local file containing only generated Boost guidelines. If Boost added a `<laravel-boost-guidelines>` block to a file containing other instructions, remove only that block. Preserve all other documentation, skills, MCP configuration, and agent instructions.

Set `"guidelines": false` in the application's `boost.json`, preserving all other settings, so `boost:update` does not recreate the generated guidelines. For subsequent installations, use `php artisan boost:install --mcp --skills`.

Create the application's `AGENTS.md` and `CLAUDE.md` if needed. Put these lines first in both files, preserving app-specific instructions below them:

```md
Read and follow: ../../AGENTS.md
Read and follow: README.md
```

For other selected agents, reference the same workspace root instructions from their application-local instruction files, adjusting relative paths as needed. The root instructions load the shared [Laravel Boost guidelines](laravel-boost-guidelines.md); read and apply them during setup as well.

The shared Laravel Boost guidelines are permanently frozen. Never modify, regenerate, or replace them, or merge generated Boost guidelines into them. Always use the shared guidelines instead of generated application guidelines.

## Final Quality Fix

Remove `vp check` and `vp check --fix` from the application's `package.json` scripts and quality aggregates. Keep Vite Plus build and development scripts when the application uses them.

After completing setup, run `composer quality:fix` once from the application root and manually fix all remaining violations.

As the final step, run `php artisan migrate:fresh --seed --no-interaction` from the application root.
