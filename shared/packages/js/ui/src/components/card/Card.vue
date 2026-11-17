<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ref } from "vue"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const element = ref<HTMLElement | null>(null)

defineExpose({ element: element })
</script>

<template>
  <div
    ref="element"
    data-slot="card"
    :class="
      cn(
        'bg-surface solid-surface noise-texture text-surface-foreground flex flex-col gap-4 rounded-lg border border-border/70 py-4 pb-6 shadow-surface min-w-0',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
