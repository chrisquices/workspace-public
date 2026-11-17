<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "workspace-packages/ui/utils"
import type { SidebarMenuButtonVariants } from "#ui/components/sidebar/index"
import { sidebarMenuButtonVariants } from "#ui/components/sidebar/index"

const props = withDefaults(defineProps<PrimitiveProps & {
  variant?: SidebarMenuButtonVariants["variant"]
  size?: SidebarMenuButtonVariants["size"] | "md"
  isActive?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  as: "a",
  size: "md",
})
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-sub-button"
    data-sidebar="menu-sub-button"
    :as="as"
    :as-child="asChild"
    :data-size="size"
    :data-active="isActive"
    :class="cn(
      sidebarMenuButtonVariants({ variant, size: size === 'md' ? 'default' : size, isActive }),
      'min-w-0 pl-10 group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
