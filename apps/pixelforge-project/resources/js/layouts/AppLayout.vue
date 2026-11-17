<script setup lang="ts">
import { Link } from "@inertiajs/vue3";
import { LogOut, Sparkles, Zap } from "@lucide/vue";
import { onMounted, ref, useTemplateRef } from "vue";
import { Toast } from "workspace-packages/ui/toast";
import { Button } from "workspace-packages/ui/button";
import { SidebarProvider } from "workspace-packages/ui/sidebar";
import { index as generations } from "@/actions/App/Http/Controllers/GenerationController";
import { index as usage } from "@/actions/App/Http/Controllers/UsageController";
import { destroy as logout } from "@/actions/Laravel/Fortify/Http/Controllers/AuthenticatedSessionController";
import PurchaseCreditsAlertDialog from "@/pages/Generations/partials/PurchaseCreditsAlertDialog.vue";
import pixelLogo from "@/../img/pixel.png";

const toastMounted = ref(false);
const purchaseCreditsDialog = useTemplateRef<InstanceType<typeof PurchaseCreditsAlertDialog>>("purchaseCreditsDialog");

onMounted(function () {
    toastMounted.value = true;
});
</script>

<template>
    <SidebarProvider class="h-svh flex-col overflow-hidden ambient-background">
        <Toast v-if="toastMounted" position="top-center" />

        <!-- Top navigation -->
        <header class="flex h-topbar-height shrink-0 items-center gap-2 px-4 sm:gap-4">
            <img :src="pixelLogo" alt="Pixel" class="size-8 shrink-0 object-contain">
            <nav class="flex items-center gap-1" aria-label="Main navigation">
                <Button as-child variant="ghost" size="sm" :class="{ 'bg-surface-muted': $page.component === 'Generations/Index' }">
                    <Link :href="generations()" :aria-current="$page.component === 'Generations/Index' ? 'page' : undefined" title="Generations">
                        <Sparkles aria-hidden="true" />
                        <span class="sr-only sm:not-sr-only">Image Generation</span>
                    </Link>
                </Button>
                <Button as-child variant="ghost" size="sm" :class="{ 'bg-surface-muted': $page.component.startsWith('Usages/') }">
                    <Link :href="usage()" :aria-current="$page.component.startsWith('Usages/') ? 'page' : undefined" title="Usage">
                        <Zap aria-hidden="true" />
                        <span class="sr-only sm:not-sr-only">Usage</span>
                    </Link>
                </Button>
            </nav>

            <!-- Account actions -->
            <div class="ml-auto flex shrink-0 items-center gap-2">
                <Button v-if="$page.props.balance" type="button" variant="outline" size="sm" class="rounded-full tabular-nums font-bold text-sm tracking-wide" :aria-label="`Usable balance: ${$page.props.balance.spendableBalance}. Buy credits`" @click="purchaseCreditsDialog?.show()">
                    <span>{{ $page.props.balance.spendableBalance }}</span>
                </Button>
                <Button as-child variant="ghost" size="sm">
                    <Link as="button" :href="logout()" title="Sign out">
                        <LogOut aria-hidden="true" />
                        <span class="sr-only">Sign out</span>
                    </Link>
                </Button>
            </div>
        </header>

        <div class="relative flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4">
            <main class="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-surface shadow-surface solid-surface noise-texture">
                <slot />
            </main>
        </div>
        <PurchaseCreditsAlertDialog ref="purchaseCreditsDialog" />
    </SidebarProvider>
</template>
<style></style>
