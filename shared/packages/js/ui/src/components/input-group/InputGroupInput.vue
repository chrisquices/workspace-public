<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { inject } from "vue"
import { cn } from "workspace-packages/ui/utils"
import { Input, type InputVariants } from 'workspace-packages/ui/input'
import { inputGroupSizeKey } from "#ui/components/input-group/context"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  size?: InputVariants["size"]
}>()

const groupSize = inject(inputGroupSizeKey, undefined)
</script>

<template>
  <Input
    data-slot="input-group-control"
    :size="props.size ?? groupSize"
    :class="cn(
      'h-full flex-1 border-0 bg-none shadow-none focus-visible:ring-0',
      props.class,
    )"
  />
</template>
