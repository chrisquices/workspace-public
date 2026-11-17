<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { InputGroupTextarea } from "workspace-packages/ui/input-group"
import { cn } from "workspace-packages/ui/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  defaultValue?: string | number
  modelValue?: string | number
}>()

const emit = defineEmits<{
  (event: "update:modelValue", value: string | number): void
}>()
</script>

<template>
  <InputGroupTextarea
    data-slot="composer-text"
    :model-value="props.modelValue"
    :default-value="props.defaultValue"
    :class="cn('max-h-64 min-h-18 rounded-2xl p-5 text-sm', props.class)"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
