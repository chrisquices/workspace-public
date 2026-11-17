<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { AlertVariants } from "#ui/components/alert/index"
import { cn } from "workspace-packages/ui/utils"
import { alertVariants } from "#ui/components/alert/index"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  variant?: AlertVariants["variant"]
}>()
</script>

<template>
  <div
    data-slot="alert"
    :class="cn(alertVariants({ variant }), props.class)"
    role="alert"
  >
    <slot />
  </div>
</template>
