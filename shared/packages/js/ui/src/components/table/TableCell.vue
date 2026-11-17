<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import {computed} from "vue"
import { cn } from "workspace-packages/ui/utils"

import {tableSizes} from "#ui/components/table/index"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  size?: keyof typeof tableSizes
  sorted?: boolean
}>(), {
  size: "default",
})
const avatarSize = computed(function () {
  const token = props.size === 'default' ? '--control-height' : `--control-height-${props.size}`
  return `calc(var(${token}) * 2 / 3)`
})
</script>

<template>
  <td
    data-slot="table-cell"
    :style="{'--table-cell-avatar-size': avatarSize}"
    :class="
      cn(
        'px-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
        tableSizes[props.size],
        '[&_[data-slot=avatar]]:max-h-(--table-cell-avatar-size) [&_[data-slot=avatar]]:max-w-(--table-cell-avatar-size)', 
        props.class,
        props.sorted && 'font-bold! text-accent!',
      )
    "
  >
    <slot />
  </td>
</template>
