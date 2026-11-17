<script setup lang="ts">
import { Head, Link } from "@inertiajs/vue3";
import { ArrowRight } from "@lucide/vue";
import { Button } from "workspace-packages/ui/button";
import { index as home } from "@/routes/home";
import pixelLogo from "@/../img/pixel.png";

const props = defineProps<{
    status: number
    title: string
    heading: string
    description: string
}>();
</script>

<template>
    <Head :title="props.title" />
    <section class="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
        <div class="w-full max-w-md">
            <div class="mb-10 flex items-center justify-center gap-3">
                <img :src="pixelLogo" alt="" class="size-10 object-contain">
                <span class="text-base font-semibold tracking-[0.18em] text-foreground">PIXEL</span>
            </div>
            <p class="text-7xl font-semibold tracking-tight text-primary sm:text-8xl">
                {{ props.status }}
            </p>
            <h1 class="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {{ props.heading }}
            </h1>
            <p class="mt-4 text-sm leading-6 text-foreground-muted">
                {{ props.description }}
            </p>

            <!-- Return home -->
            <Button as-child type="button" variant="primary" size="lg" class="mt-8">
                <Link :href="home()">
                    Back to Home
                    <ArrowRight />
                </Link>
            </Button>
        </div>
    </section>
</template>
<style></style>
