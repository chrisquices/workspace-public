<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "workspace-packages/ui/utils";
const props = defineProps<{
    class?: HTMLAttributes["class"]
}>();
</script>
<template>
    <div :class="cn('flex min-h-0 shrink-0', props.class)" data-slot="page-aside">
        <slot />
    </div>
</template>

<style></style>
