<script setup lang="ts">
import type {ToastSnapshot} from 'workspace-packages/ui-engines/toast';
import {onBeforeUnmount, shallowRef} from 'vue';
import {CircleCheck, CircleX, Info, X} from '@lucide/vue';
import {Button} from 'workspace-packages/ui/button';
import {createToastHost} from '#ui/components/toast/toast';

type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

const props = withDefaults(defineProps<{position?: ToastPosition}>(), {
    position: 'top-right',
});

const positionClasses: Record<ToastPosition, string> = {
    'top-left': 'top-4 sm:right-auto',
    'top-center': 'top-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2',
    'top-right': 'top-4 sm:left-auto',
    'bottom-left': 'bottom-4 sm:right-auto',
    'bottom-center': 'bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2',
    'bottom-right': 'bottom-4 sm:left-auto',
};

const notifications = shallowRef<ToastSnapshot[]>([]);
const host = createToastHost(function (state) {
    notifications.value = state.visible;
});

onBeforeUnmount(host.destroy);
</script>

<template>
    <TransitionGroup
        tag="section"
        data-slot="toast-host"
        class="pointer-events-none fixed inset-x-4 z-toast flex flex-col gap-3 sm:w-104"
        :class="positionClasses[props.position]"
        appear
        enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="pointer-events-none transition-opacity duration-200 ease-in motion-reduce:transition-none"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div
            v-for="notification in notifications"
            :key="`${notification.id}:${notification.generation}`"
            :role="notification.variant === 'error' ? 'alert' : 'status'"
            :data-variant="notification.variant"
            class="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-popover solid-surface noise-texture p-4 text-surface-foreground shadow-popover">
            <CircleCheck v-if="notification.variant === 'success'" class="mt-0.5 size-5 shrink-0 text-success" />
            <CircleX v-else-if="notification.variant === 'error'" class="mt-0.5 size-5 shrink-0 text-destructive" />
            <Info v-else class="mt-0.5 size-5 shrink-0 text-info" />

            <p class="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{{ notification.title }}</p>

            <!-- Dismiss notification -->
            <Button type="button" variant="ghost" size="icon-xs" @click="host.dismiss(notification)">
                <X />
                <span class="sr-only">Dismiss notification</span>
            </Button>
        </div>
    </TransitionGroup>
</template>
