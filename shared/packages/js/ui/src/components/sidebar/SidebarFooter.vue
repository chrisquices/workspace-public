<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="sidebar-footer"
    data-sidebar="footer"
    :class="cn('flex items-center gap-2 justify-between px-4 py-4 font-medium tracking-wide [&_svg]:size-4 [&_svg]:shrink-0', props.class)"
  >
    <slot />
  </div>
</template>
