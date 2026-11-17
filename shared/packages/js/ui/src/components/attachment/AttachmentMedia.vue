<script setup lang="ts">
import type {HTMLAttributes} from "vue"
import type {AttachmentMediaVariants} from "#ui/components/attachment/index"
import {cn} from "workspace-packages/ui/utils"
import {attachmentMediaVariants} from "#ui/components/attachment/index"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  variant?: AttachmentMediaVariants["variant"]
}>()
</script>

<template>
  <div
      data-slot="attachment-media"
      :data-variant="variant"
      :class="cn(attachmentMediaVariants({ variant }), props.class)"
  >
    <slot/>
  </div>
</template>
