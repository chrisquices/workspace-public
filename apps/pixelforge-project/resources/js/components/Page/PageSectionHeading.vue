<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "workspace-packages/ui/utils";

const props = defineProps<{
    class?: HTMLAttributes["class"]
}>();
</script>

<template>
    <header :class="cn('flex items-center gap-2 justify-between h-header-height px-4 py-4 font-medium tracking-wide [&_svg]:size-4 [&_svg]:shrink-0', props.class)" data-slot="page-section-heading">
        <slot />
    </header>
</template>
<style></style>
