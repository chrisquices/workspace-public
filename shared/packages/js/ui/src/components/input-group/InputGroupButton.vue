<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { InputGroupButtonVariants } from "#ui/components/input-group/index"
import type { ButtonVariants } from 'workspace-packages/ui/button'
import { cn } from "workspace-packages/ui/utils"
import { Button } from 'workspace-packages/ui/button'
import { inputGroupButtonVariants } from "#ui/components/input-group/index"

interface InputGroupButtonProps {
  variant?: ButtonVariants["variant"]
  size?: InputGroupButtonVariants["size"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<InputGroupButtonProps>(), {
  size: "xs",
  variant: "ghost",
})
</script>

<template>
  <Button
    :data-size="props.size"
    :variant="props.variant"
    :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)"
  >
    <slot />
  </Button>
</template>
