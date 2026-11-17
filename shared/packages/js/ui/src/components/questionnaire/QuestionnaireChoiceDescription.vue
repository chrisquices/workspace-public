<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from 'workspace-packages/ui/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    data-slot="questionnaire-choice-description"
    :class="cn('text-foreground-muted', props.class)"
  >
    <slot />
  </span>
</template>
