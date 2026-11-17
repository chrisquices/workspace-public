<script setup lang="ts">
import type {AvatarFallbackProps} from "reka-ui"
import type {HTMLAttributes} from "vue"
import {reactiveOmit} from "@vueuse/core"
import {AvatarFallback} from "reka-ui"
import {cn} from "workspace-packages/ui/utils"

const props = defineProps<AvatarFallbackProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <AvatarFallback
      data-slot="avatar-fallback"
      v-bind="delegatedProps"
      :class="cn('bg-secondary text-secondary-foreground/60 flex size-full items-center justify-center rounded-[inherit] border border-border-faint text-xs', props.class)"
  >
    <slot/>
  </AvatarFallback>
</template>
