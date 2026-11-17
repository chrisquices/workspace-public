<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { computed, useAttrs } from "vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "workspace-packages/ui/tooltip"
import { cn } from "workspace-packages/ui/utils"
import { inputVariants, type InputVariants } from "#ui/components/input/index"

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes["class"]
  size?: InputVariants["size"]
  error?: string
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
const attrs = useAttrs()
const inputIsFile = computed(() => attrs.type === "file")
const inputClass = computed(() => cn(
  inputVariants({ size: props.size }),
  props.class,
))
</script>

<template>
  <Tooltip v-if="props.error">
    <TooltipTrigger as-child>
      <input
        v-if="inputIsFile"
        v-bind="attrs"
        data-slot="input"
        aria-invalid="true"
        :class="inputClass"
      >
      <input
        v-else
        v-bind="attrs"
        v-model="modelValue"
        data-slot="input"
        aria-invalid="true"
        :class="inputClass"
      >
    </TooltipTrigger>

    <TooltipContent>
      {{ props.error }}
    </TooltipContent>
  </Tooltip>

  <input
    v-else-if="inputIsFile"
    v-bind="attrs"
    data-slot="input"
    :class="inputClass"
  >
  <input
    v-else
    v-bind="attrs"
    v-model="modelValue"
    data-slot="input"
    :class="inputClass"
  >
</template>
