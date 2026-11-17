<script setup lang="ts">
import { X } from "@lucide/vue"
import { Button } from "workspace-packages/ui/button"

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Button
    type="button"
    variant="secondary"
    size="icon-2xs"
    aria-label="Remove"
    :disabled="props.disabled"
    @click="emit('click', $event)"
  >
    <X />
  </Button>
</template>
