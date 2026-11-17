<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { InputGroupAddon } from "workspace-packages/ui/input-group"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <InputGroupAddon
    data-slot="composer-toolbar"
    align="block-end"
    :class="cn('min-w-0 flex-wrap justify-between gap-2 px-3 pb-3', props.class)"
  >
    <slot />
  </InputGroupAddon>
</template>
