<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { GridVariants } from "workspace-packages/ui/grid"
import { Grid } from "workspace-packages/ui/grid"
import { cn } from "workspace-packages/ui/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  gap?: GridVariants["gap"]
}>(), {
  gap: "sm",
})
</script>

<template>
  <Grid
    data-slot="composer-grid"
    :gap="props.gap"
    :class="cn('order-first flex w-full overflow-x-auto px-3 pt-3 pb-2.5 text-sm font-medium text-foreground-muted', props.class)"
  >
    <slot />
  </Grid>
</template>
