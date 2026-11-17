<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "workspace-packages/ui/utils";

const props = defineProps<{
    class?: HTMLAttributes["class"]
}>();
</script>

<template>
    <section :class="cn('flex min-w-0 flex-col min-h-0 flex-1 gap-0 mb-0 overflow-hidden sm:gap-0 sm:mb-0', props.class)" data-slot="page-section">
        <slot />
    </section>
</template>
<style></style>
