<script setup lang="ts">
import type { EditableInputProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { EditableInput, useForwardProps } from "reka-ui"
import { inputVariants, type InputVariants } from "workspace-packages/ui/input"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<EditableInputProps & {
  class?: HTMLAttributes["class"]
  size?: InputVariants["size"]
}>()

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <EditableInput
    data-slot="editable-input"
    v-bind="forwarded"
    :class="cn(
      inputVariants({ size: props.size }),
      props.class,
    )"
  >
    <slot />
  </EditableInput>
</template>
