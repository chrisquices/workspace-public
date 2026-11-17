<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"
import { Separator } from 'workspace-packages/ui/separator'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Separator
    data-slot="sidebar-separator"
    data-sidebar="separator"
    :class="cn('bg-sidebar-border w-auto', props.class)"
  >
    <slot />
  </Separator>
</template>
