<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { GridItem } from "workspace-packages/ui/grid"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <GridItem :class="cn('w-24 shrink-0', props.class)">
    <slot />
  </GridItem>
</template>
