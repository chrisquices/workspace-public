<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="context-menu-label-container"
    :class="cn('bg-accent/5 w-full flex flex-col rounded-md', props.class)"
  >
    <slot />
  </div>
</template>
