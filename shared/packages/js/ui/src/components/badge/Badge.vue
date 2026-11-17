<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { BadgeVariants } from "#ui/components/badge/index"
import { reactiveOmit } from "@vueuse/core"
import { Primitive } from "reka-ui"
import { cn } from "workspace-packages/ui/utils"
import { badgeVariants } from "#ui/components/badge/index"

const props = defineProps<PrimitiveProps & {
  variant?: BadgeVariants["variant"]
  size?: BadgeVariants["size"]
  class?: HTMLAttributes["class"]
}>()

const delegatedProps = reactiveOmit(props, "class", "variant", "size")
</script>

<template>
  <Primitive
    data-slot="badge"
    :data-variant="variant"
    :data-size="size"
    :class="cn(badgeVariants({ variant, size }), props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </Primitive>
</template>
