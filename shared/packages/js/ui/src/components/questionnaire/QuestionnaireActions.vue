<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from 'workspace-packages/ui/utils'

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes['class']
}>(), {
  as: 'div',
})
</script>

<template>
  <Primitive
    data-slot="questionnaire-actions"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn(
      'gap-2 sm:min-h-8 grid min-h-control-height w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
