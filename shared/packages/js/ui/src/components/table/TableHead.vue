<script setup lang="ts">
import type {HTMLAttributes} from "vue"
import {computed} from "vue"
import {ChevronDown, ChevronUp, ChevronsUpDown} from "@lucide/vue"
import {cn} from "workspace-packages/ui/utils"

import {tableSizes} from "#ui/components/table/index"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  sortable?: boolean,
  size?: keyof typeof tableSizes
  sorted?: boolean
  sortDirection?: "asc" | "desc"
}>(), {
  size: "default",
})
const sortIcon = computed(function () {
  if (!props.sorted) return ChevronsUpDown
  if (props.sortDirection === 'asc') return ChevronUp
  if (props.sortDirection === 'desc') return ChevronDown
  return ChevronsUpDown
})
</script>

<template>
  <th
    data-slot="table-head"
    :aria-sort="sortable ? (sorted && sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none') : undefined"
    :class="cn(
    'text-foreground-subtle uppercase text-2xs font-bold px-4 text-left align-middle tracking-widest whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
    props.sortable && 'cursor-pointer select-none transition-colors hover:text-accent/80',
    props.sorted && 'text-accent',
    tableSizes[props.size],
    props.class,
  )"
  >
    <span v-if="props.sortable" class="inline-flex items-center gap-1.5">
      <slot/>
      <component
        :is="sortIcon"
        :class="cn(
          'size-3.5 opacity-50',
          props.sorted && 'opacity-100',
        )"
      />
    </span>

    <slot v-else/>
  </th>
</template>
