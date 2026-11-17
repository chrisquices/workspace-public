<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"

interface Props {
  side: "left" | "right"
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="spacer"
    aria-hidden="true"
    :class="cn({ 'ml-auto': props.side === 'left', 'mr-auto': props.side === 'right' }, props.class)"
  />
</template>
