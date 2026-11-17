<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "workspace-packages/ui/utils";

const props = defineProps<{
    class?: HTMLAttributes["class"]
}>();
</script>

<template>
    <div :class="cn('contents items-center gap-2', props.class)" data-slot="page-section-heading-actions">
        <slot />
    </div>
</template>
<style></style>
