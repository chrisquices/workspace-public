<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { GridItemOverlayVariants } from "#ui/components/grid/index"
import { cn } from "workspace-packages/ui/utils"
import { gridItemOverlayVariants } from "#ui/components/grid/index"

interface Props {
  class?: HTMLAttributes["class"]
  variant?: GridItemOverlayVariants["variant"]
  visibility?: GridItemOverlayVariants["visibility"]
}

const props = withDefaults(defineProps<Props>(), {
  variant: "transparent",
  visibility: "always",
})
</script>

<template>
  <div
      data-slot="grid-item-overlay"
      :data-variant="props.variant"
      :data-visibility="props.visibility"
      :class="cn(gridItemOverlayVariants({ variant: props.variant, visibility: props.visibility }), props.class)"
  >
    <slot />
  </div>
</template>
