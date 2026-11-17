<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { GridItemAction } from "workspace-packages/ui/grid"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <GridItemAction :class="cn('[&>button]:rounded-full', props.class)">
    <slot />
  </GridItemAction>
</template>
