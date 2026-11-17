<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { GridItemLabelVariants } from "workspace-packages/ui/grid"
import { GridItemLabel } from "workspace-packages/ui/grid"
import { cn } from "workspace-packages/ui/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  name?: string
  variant?: GridItemLabelVariants["variant"]
}>(), {
  variant: "overlay",
})
</script>

<template>
  <GridItemLabel
    :name="props.name"
    :variant="props.variant"
    :class="cn('text-xs font-medium', props.class)"
  >
    <slot />
  </GridItemLabel>
</template>
