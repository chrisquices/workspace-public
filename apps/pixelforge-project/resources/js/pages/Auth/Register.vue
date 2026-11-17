<script setup lang="ts">
import { Head, Link } from "@inertiajs/vue3";
import { ArrowRight, ShieldCheck } from "@lucide/vue";
import { useInertiaHelperForm } from "workspace-packages/inertia-helper";
import { Button } from "workspace-packages/ui/button";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "workspace-packages/ui/field";
import { Input } from "workspace-packages/ui/input";
import { index as home } from "@/routes/home";
import { index as login } from "@/actions/App/Http/Controllers/Auth/LoginController";
import { submit as submitRegister } from "@/actions/App/Http/Controllers/Auth/RegisterController";
import pixelLogo from "@/../img/pixel.png";

const registerForm = useInertiaHelperForm({
    config: {
        openable: false,
        minimumLoading: false,
    },
    form: {
        name: "",
        email: "",
        password: "",
        password_confirmation: "",

        handleSubmit(): void {
            if (this.processing) return;

            this.post(submitRegister.url(), {
                onFinish: function () {
                    registerForm.password = "";
                    registerForm.password_confirmation = "";
                },
            });
        },
    },
});
</script>

<template>
    <div class="relative flex min-h-0 w-full flex-1 overflow-auto text-foreground">
        <Head title="Register" />

        <section class="relative flex min-h-full flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
            <div class="w-full max-w-[24rem]">

                <!-- Brand Link -->
                <header class="mb-12 flex justify-center">
                    <Link :href="home()" class="group flex w-fit items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span class="grid size-8 place-items-center">
                            <img :src="pixelLogo" alt="" class="size-8 object-contain">
                        </span>

                        <span class="text-2xl font-bold tracking-[0.2em] text-foreground pt-3">ARAGON</span>
                    </Link>
                </header>

                <form class="space-y-6" @submit.prevent="registerForm.handleSubmit()">
                    <FieldGroup class="gap-5">

                        <!-- Name -->
                        <Field orientation="vertical" :data-invalid="Boolean(registerForm.errors.name)">
                            <FieldLabel for="name">Name</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="name"
                                    type="text"
                                    name="name"
                                    class="h-11 bg-surface/60 px-3.5"
                                    v-model="registerForm.name"
                                    required
                                    autofocus
                                    autocomplete="name" />

                                <FieldError v-if="registerForm.errors.name" :errors="[registerForm.errors.name]" />
                            </FieldContent>
                        </Field>

                        <!-- Email address -->
                        <Field orientation="vertical" :data-invalid="Boolean(registerForm.errors.email)">
                            <FieldLabel for="email">Email address</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    class="h-11 bg-surface/60 px-3.5"
                                    v-model="registerForm.email"
                                    required
                                    autocomplete="email" />

                                <FieldError v-if="registerForm.errors.email" :errors="[registerForm.errors.email]" />
                            </FieldContent>
                        </Field>

                        <!-- Password -->
                        <Field orientation="vertical" :data-invalid="Boolean(registerForm.errors.password)">
                            <FieldLabel for="password">Password</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    class="h-11 bg-surface/60 px-3.5"
                                    v-model="registerForm.password"
                                    required
                                    autocomplete="new-password" />

                                <FieldError v-if="registerForm.errors.password" :errors="[registerForm.errors.password]" />
                            </FieldContent>
                        </Field>

                        <!-- Confirm password -->
                        <Field orientation="vertical" :data-invalid="Boolean(registerForm.errors.password_confirmation)">
                            <FieldLabel for="password-confirmation">Confirm password</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="password-confirmation"
                                    type="password"
                                    name="password_confirmation"
                                    class="h-11 bg-surface/60 px-3.5"
                                    v-model="registerForm.password_confirmation"
                                    required
                                    autocomplete="new-password" />

                                <FieldError v-if="registerForm.errors.password_confirmation" :errors="[registerForm.errors.password_confirmation]" />
                            </FieldContent>
                        </Field>
                    </FieldGroup>

                    <!-- Register -->
                    <Button type="submit" variant="primary" size="lg" class="group w-full" :disabled="registerForm.processing">
                        <ArrowRight class="order-last transition-transform group-hover:translate-x-0.5" />
                        <span class="sr-only" aria-hidden="true">Register</span>
                        <span>{{ registerForm.processing ? 'Registering…' : 'Register' }}</span>
                    </Button>
                </form>

                <p class="mt-6 text-center text-sm text-foreground-muted">
                    Already have an account?
                    <Link :href="login()" class="text-primary hover:underline">Sign in</Link>
                </p>
            </div>

            <p class="mt-10 flex items-center justify-center gap-2 text-center text-xs leading-5 text-foreground-subtle">
                <ShieldCheck class="size-3.5 shrink-0" />
                No real AI. No real money.
            </p>
        </section>
    </div>
</template>

<style></style>
