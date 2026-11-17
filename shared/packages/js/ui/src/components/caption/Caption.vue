<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { CaptionVariants } from "#ui/components/caption/index"
import { Primitive } from "reka-ui"
import { cn } from "workspace-packages/ui/utils"
import { captionVariants } from "#ui/components/caption/index"

interface Props extends PrimitiveProps {
  variant?: CaptionVariants["variant"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "span",
  variant: "subtle",
})
</script>

<template>
  <Primitive
    data-slot="caption"
    :as="as"
    :as-child="asChild"
    :class="cn(captionVariants({ variant }), props.class)"
  >
    <slot />
  </Primitive>
</template>
