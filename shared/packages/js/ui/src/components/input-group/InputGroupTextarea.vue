<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "workspace-packages/ui/utils"
import { Textarea } from 'workspace-packages/ui/textarea'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Textarea
    data-slot="input-group-control"
    :class="cn(
      'flex-1 resize-none border-0 bg-none py-3 shadow-none focus-visible:ring-0',
      props.class,
    )"
  />
</template>
