<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <div
      data-slot="grid-item-action"
      :class="cn('absolute top-2 right-2 flex items-center gap-1', props.class)"
  >
    <slot />
  </div>
</template>
