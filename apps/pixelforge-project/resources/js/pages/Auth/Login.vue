<script setup lang="ts">
import { Head, Link } from "@inertiajs/vue3";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "@lucide/vue";
import { ref } from "vue";
import { useInertiaHelperForm } from "workspace-packages/inertia-helper";
import { Button } from "workspace-packages/ui/button";
import { Checkbox } from "workspace-packages/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "workspace-packages/ui/field";
import { Input } from "workspace-packages/ui/input";
import { index as home } from "@/routes/home";
import { submit as submitLogin } from "@/actions/App/Http/Controllers/Auth/LoginController";
import { index as register } from "@/actions/App/Http/Controllers/Auth/RegisterController";
import pixelLogo from "@/../img/pixel.png";

const props = defineProps<{
    status?: string
}>();

const passwordIsVisible = ref(false);
const loginForm = useInertiaHelperForm({
    config: {
        openable: false,
        minimumLoading: false,
    },
    form: {
        email: "user@email.com",
        password: "password",
        remember: false,

        handleSubmit(): void {
            if (this.processing) return;

            this.submit();
        },

        submit(): void {
            this.post(submitLogin.url(), {
                onSuccess: function () {
                    loginForm.password = "";
                },
            });
        },
    },
});

function togglePasswordVisibility(): void {
    passwordIsVisible.value = !passwordIsVisible.value;
}
</script>

<template>
    <div class="relative flex min-h-0 w-full flex-1 overflow-hidden text-foreground">
        <Head title="Login" />

        <!-- Authentication Panel -->
        <section class="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 pt-10 pb-24 sm:px-8 lg:px-12">
            <div class="w-full max-w-[24rem] -translate-y-4">

                <!-- Brand Link -->
                <header class="mb-12 flex justify-center">
                    <Link :href="home()" class="group flex w-fit items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span class="grid size-8 place-items-center">
                            <img :src="pixelLogo" alt="" class="size-8 object-contain">
                        </span>

                        <span class="text-2xl font-bold tracking-[0.2em] text-foreground pt-3">ARAGON</span>
                    </Link>
                </header>

                <!-- Session Status -->
                <div v-if="props.status" class="mb-6 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm leading-6 text-success-foreground" role="status">
                    {{ props.status }}
                </div>

                <!-- Login Form -->
                <form class="space-y-6" @submit.prevent="loginForm.handleSubmit()">
                    <FieldGroup class="gap-5">

                        <!-- Email address -->
                        <Field orientation="vertical" :data-invalid="Boolean(loginForm.errors.email)">
                            <FieldLabel for="email">Email address</FieldLabel>
                            <FieldContent>

                                <!-- Email address -->
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    class="h-11 bg-surface/60 px-3.5"
                                    v-model="loginForm.email"
                                    placeholder="you@example.com"
                                    required
                                    autofocus
                                    autocomplete="email" />

                                <FieldError v-if="loginForm.errors.email" id="email-error" :errors="[loginForm.errors.email]" />
                            </FieldContent>
                        </Field>

                        <!-- Password -->
                        <Field orientation="vertical" :data-invalid="Boolean(loginForm.errors.password)">
                            <FieldLabel for="password">Password</FieldLabel>
                            <FieldContent>
                                <div class="relative">

                                    <!-- Password -->
                                    <Input
                                        id="password"
                                        :type="passwordIsVisible ? 'text' : 'password'"
                                        name="password"
                                        class="h-11 bg-surface/60 px-3.5 pr-11"
                                        v-model="loginForm.password"
                                        placeholder="Enter your password"
                                        required
                                        autocomplete="current-password" />

                                    <!-- Toggle password visibility -->
                                    <Button type="button" variant="ghost" size="icon-sm" class="absolute top-1/2 right-1.5 -translate-y-1/2 text-foreground-muted" @click="togglePasswordVisibility">
                                        <EyeOff v-if="passwordIsVisible" class="size-4" />
                                        <Eye v-else class="size-4" />
                                        <span class="sr-only">Toggle password visibility</span>
                                    </Button>
                                </div>

                                <FieldError v-if="loginForm.errors.password" id="password-error" :errors="[loginForm.errors.password]" />
                            </FieldContent>
                        </Field>

                        <!-- Keep me signed in -->
                        <Field orientation="horizontal" class="gap-2.5" :data-invalid="false">
                            <FieldContent>
                                <div class="flex items-center gap-2.5">

                                    <!-- Keep me signed in -->
                                    <Checkbox id="remember" name="remember" v-model="loginForm.remember" />

                                    <FieldLabel for="remember" class="cursor-pointer text-sm text-foreground-muted">Keep me signed in</FieldLabel>
                                </div>
                            </FieldContent>
                        </Field>
                    </FieldGroup>

                    <!-- Sign in -->
                    <Button type="submit" variant="primary" size="lg" class="group w-full" :disabled="loginForm.processing" data-test="login-button">
                        <ArrowRight class="order-last transition-transform group-hover:translate-x-0.5" />
                        <span class="sr-only" aria-hidden="true">Sign in</span>
                        <span>
                            {{ loginForm.processing ? 'Signing in…' : 'Sign in' }}
                        </span>
                    </Button>
                </form>

                <p class="mt-6 text-center text-sm text-foreground-muted">
                    Don't have an account?
                    <Link :href="register()" class="text-primary hover:underline">Register</Link>
                </p>
            </div>

            <!-- Jokes -->
            <p class="absolute inset-x-5 bottom-10 flex items-center justify-center gap-2 text-center text-xs leading-5 text-foreground-subtle">
                <ShieldCheck class="size-3.5 shrink-0" />
                No real AI. No real money.
            </p>
        </section>
    </div>
</template>

<style></style>
