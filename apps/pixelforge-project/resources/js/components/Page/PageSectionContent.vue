<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ScrollArea } from "workspace-packages/ui/scroll-area";
import { cn } from "workspace-packages/ui/utils";
const props = defineProps<{
    contentClass?: HTMLAttributes["class"]
}>();
</script>
<template>
    <div class="grid min-h-0 flex-1 gap-0 overflow-hidden" data-slot="page-section-content">

    <!-- Scrollable content -->
        <ScrollArea class="h-full min-h-0 min-w-0 [&_[data-slot=scroll-area-viewport]>div]:flex [&_[data-slot=scroll-area-viewport]>div]:min-h-full [&_[data-slot=scroll-area-viewport]>div]:flex-col">
            <div :class="cn('flex min-w-0 flex-1 flex-col', props.contentClass)">
                <slot />
            </div>
        </ScrollArea>
    </div>
</template>

<style></style>
