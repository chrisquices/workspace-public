<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { InputGroup } from "workspace-packages/ui/input-group"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <InputGroup
    data-slot="composer"
    :class="cn(
      'h-auto flex-col rounded-2xl',
      'has-[[data-slot=composer-text]:focus-visible]:border-ring has-[[data-slot=composer-text]:focus-visible]:ring-ring/50 has-[[data-slot=composer-text]:focus-visible]:ring-3',
      props.class,
    )"
  >
    <slot />
  </InputGroup>
</template>
