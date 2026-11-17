<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { provide, toRef } from "vue"
import type { InputVariants } from "workspace-packages/ui/input"
import {inputHeights} from "workspace-packages/ui/input"
import { cn } from "workspace-packages/ui/utils"
import { inputGroupSizeKey } from "#ui/components/input-group/context"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  size?: InputVariants["size"]
}>(), {
  size: "default",
})

provide(inputGroupSizeKey, toRef(props, "size"))
</script>

<template>
  <div
    data-slot="input-group"
    :data-size="props.size"
    role="group"
    :class="cn(
      'group/input-group border-input-border bg-input noise-texture solid-surface relative flex w-full items-center overflow-hidden border shadow-xs transition-[color,box-shadow] outline-none',
      'min-w-0 has-[>textarea]:h-auto',
      inputHeights[props.size ?? 'default'],
      'rounded-sm',

      // Variants based on alignment.
      'has-[>[data-align=inline-start]]:[&>input]:pl-2',
      'has-[>[data-align=inline-end]]:[&>input]:pr-2',
      'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
      'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',

      // Focus state.
      'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-3',

      // Error state.
      'has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive',

      props.class,
    )"
  >
    <slot />
  </div>
</template>
