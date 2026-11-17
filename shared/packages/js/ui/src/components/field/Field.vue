<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { FieldVariants } from "#ui/components/field/index"
import { cn } from "workspace-packages/ui/utils"
import { fieldVariants } from "#ui/components/field/index"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  orientation: NonNullable<FieldVariants["orientation"]>
}>()
</script>

<template>
  <div
    role="group"
    data-slot="field"
    :data-orientation="orientation"
    :class="cn(
      fieldVariants({ orientation }),
      props.class,
    )"
  >
    <slot />
  </div>
</template>
