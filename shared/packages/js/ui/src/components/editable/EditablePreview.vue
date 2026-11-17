<script setup lang="ts">
import type { EditablePreviewProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { EditablePreview, injectEditableRootContext, useForwardProps } from "reka-ui"
import { inputSizes } from "workspace-packages/ui/input"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<EditablePreviewProps & {
  class?: HTMLAttributes["class"]
  size?: keyof typeof inputSizes
}>()

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
const context = injectEditableRootContext()
</script>

<template>
  <EditablePreview
    data-slot="editable-preview"
    v-bind="forwarded"
    :tabindex="context.disabled.value || context.readonly.value ? -1 : 0"
    :aria-disabled="context.disabled.value || undefined"
    :data-disabled="context.disabled.value ? '' : undefined"
    :data-readonly="context.readonly.value ? '' : undefined"
    :data-empty="context.isEmpty.value ? '' : undefined"
    :class="cn(
      'inline-flex w-full min-w-0 cursor-text items-center rounded-md border border-transparent py-1 transition-[color,box-shadow] outline-none hover:bg-surface data-[empty]:text-foreground-muted data-[disabled]:pointer-events-none data-[readonly]:cursor-default',
      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
      inputSizes[props.size ?? 'default'],
      props.class,
    )"
  >
    <slot />
  </EditablePreview>
</template>
