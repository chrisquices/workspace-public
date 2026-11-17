<script setup lang="ts">
import type { Component } from "vue"
import type { SidebarMenuButtonProps } from "#ui/components/sidebar/SidebarMenuButtonChild.vue"
import { reactiveOmit } from "@vueuse/core"
import { computed } from "vue"
import { Tooltip, TooltipContent, TooltipTrigger } from 'workspace-packages/ui/tooltip'
import SidebarMenuButtonChild from "#ui/components/sidebar/SidebarMenuButtonChild.vue"
import { useSidebar } from "#ui/components/sidebar/utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SidebarMenuButtonProps & {
  tooltip?: string | Component
}>(), {
  as: "button",
  variant: "default",
  size: "default",
})

const { isMobile, state } = useSidebar(props.tooltip ? undefined : null) ?? {}

const delegatedProps = reactiveOmit(props, "tooltip")

const effectiveSize = computed(() =>
  props.size === "default" && state?.value === "collapsed" && !isMobile?.value
    ? "icon"
    : props.size,
)
</script>

<template>
  <SidebarMenuButtonChild v-if="!tooltip" v-bind="{ ...delegatedProps, ...$attrs, size: effectiveSize }">
    <slot />
  </SidebarMenuButtonChild>

  <Tooltip v-else>
    <TooltipTrigger as-child>
      <SidebarMenuButtonChild v-bind="{ ...delegatedProps, ...$attrs, size: effectiveSize }">
        <slot />
      </SidebarMenuButtonChild>
    </TooltipTrigger>
    <TooltipContent
      side="right"
      align="center"
      :hidden="(state !== 'collapsed' && size !== 'icon') || isMobile"
    >
      <template v-if="typeof tooltip === 'string'">
        {{ tooltip }}
      </template>
      <component :is="tooltip" v-else />
    </TooltipContent>
  </Tooltip>
</template>
