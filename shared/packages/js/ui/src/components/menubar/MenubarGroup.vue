<script setup lang="ts">
import type { MenubarGroupProps } from "reka-ui"
import { MenubarGroup } from "reka-ui"

const props = defineProps<MenubarGroupProps>()
</script>

<template>
  <MenubarGroup
    data-slot="menubar-group"
    class="space-y-2"
    v-bind="props"
  >
    <slot />
  </MenubarGroup>
</template>
