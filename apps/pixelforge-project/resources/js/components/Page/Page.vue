<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "workspace-packages/ui/utils";

const props = defineProps<{
    class?: HTMLAttributes["class"]
}>();
</script>

<template>
    <div :class="cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', props.class)" data-slot="page">
        <slot />
    </div>
</template>
<style></style>
