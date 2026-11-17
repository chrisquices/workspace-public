<script setup lang="ts" generic="T extends { title: string }">
import { computed, reactive, useTemplateRef, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { cn } from 'workspace-packages/ui/utils';
import { BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#ui/components/breadcrumb/index';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#ui/components/dropdown-menu/index';
import { Tooltip, TooltipContent, TooltipTrigger } from '#ui/components/tooltip/index';

const props = defineProps<{
  items: readonly T[];
  class?: HTMLAttributes['class'];
}>();

defineSlots<{
  link(props: { item: T }): unknown;
  trailing?(): unknown;
}>();

const container = useTemplateRef<HTMLElement>('container');
const measurements = useTemplateRef<HTMLElement>('measurements');
const trailing = useTemplateRef<HTMLElement>('trailing');

// region --- Overflow -------------------------------------------------------------------------------------------------
const overflow = reactive({
  available: 0,
  widths: [] as number[],
  separatorWidth: 0,
  triggerWidth: 0,
  trailingWidth: 0,
  gap: 0,

  measure(): void {
    const element = measurements.value;
    if (!element || !container.value) return;

    overflow.available = container.value.clientWidth;
    overflow.widths = Array.from(element.querySelectorAll<HTMLElement>('[data-measure-item]'), function (item) {
      return item.getBoundingClientRect().width;
    });
    overflow.separatorWidth = element.querySelector<HTMLElement>('[data-measure-separator]')?.getBoundingClientRect().width ?? 0;
    overflow.triggerWidth = element.querySelector<HTMLElement>('[data-measure-trigger]')?.getBoundingClientRect().width ?? 0;
    overflow.trailingWidth = trailing.value?.getBoundingClientRect().width ?? 0;
    const list = element.querySelector<HTMLElement>('[data-slot=breadcrumb-list]');
    overflow.gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
  },

  width(indices: number[]): number {
    let width = 0;
    for (const index of indices) {
      width += index === -1 ? overflow.triggerWidth : overflow.widths[index] ?? 0;
    }
    let count = indices.length;
    if (trailing.value) {
      width += overflow.trailingWidth;
      count += 1;
    }
    return width + Math.max(0, count - 1) * (overflow.separatorWidth + overflow.gap * 2);
  },
});

const visibleIndices = computed(function () {
  const indices = props.items.map(function (_, index) { return index; });
  if (indices.length < 2 || !overflow.available || overflow.width(indices) <= overflow.available) return indices;

  // Preserve the first ancestor until only it and the current item remain.
  indices.splice(1, 0, -1);
  while (indices.length > 3 && overflow.width(indices) > overflow.available) {
    indices.splice(2, 1);
  }
  if (overflow.width(indices) > overflow.available) indices.shift();
  return indices;
});

const hiddenItems = computed(function () {
  return props.items.filter(function (_, index) {
    return !visibleIndices.value.includes(index);
  });
});

useResizeObserver([container, measurements, trailing], overflow.measure);
watch(function () { return props.items; }, overflow.measure, { deep: true, flush: 'post' });
// endregion
</script>

<template>
  <div ref="container" :class="cn('relative min-w-0 flex-1 text-sm', props.class)">
    <BreadcrumbList class="flex-nowrap whitespace-nowrap text-[length:inherit]">
      <template v-for="(index, position) in visibleIndices" :key="index">
        <BreadcrumbSeparator v-if="position" class="shrink-0" />

        <BreadcrumbItem v-if="index === -1" class="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Show hidden breadcrumbs" class="rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
              <BreadcrumbEllipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem v-for="(item, hiddenIndex) in hiddenItems" :key="hiddenIndex" as-child :title="item.title">
                <slot name="link" :item="item" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>

        <BreadcrumbItem v-else class="min-w-0">
          <Tooltip>
            <TooltipTrigger as-child>
              <BreadcrumbPage v-if="index === props.items.length - 1" class="truncate" tabindex="0">
                {{ props.items[index].title }}
              </BreadcrumbPage>
              <BreadcrumbLink v-else as-child class="block truncate font-normal">
                <slot name="link" :item="props.items[index]" />
              </BreadcrumbLink>
            </TooltipTrigger>
            <TooltipContent class="max-w-xs break-words">{{ props.items[index].title }}</TooltipContent>
          </Tooltip>
        </BreadcrumbItem>
      </template>

      <BreadcrumbSeparator v-if="$slots.trailing && props.items.length" class="shrink-0" />
      <BreadcrumbItem v-if="$slots.trailing" class="shrink-0">
        <span ref="trailing" class="inline-flex"><slot name="trailing" /></span>
      </BreadcrumbItem>
    </BreadcrumbList>

    <!-- Measure full labels without duplicating links, menus, or focus targets. -->
    <div class="pointer-events-none invisible absolute inset-0 overflow-hidden" aria-hidden="true" inert>
      <div ref="measurements" class="w-max">
        <BreadcrumbList class="flex-nowrap whitespace-nowrap text-[length:inherit]">
          <BreadcrumbItem v-for="(item, index) in props.items" :key="index" data-measure-item>
            <BreadcrumbPage v-if="index === props.items.length - 1">{{ item.title }}</BreadcrumbPage>
            <BreadcrumbLink v-else as="span" class="font-normal">{{ item.title }}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator data-measure-separator />
          <BreadcrumbItem data-measure-trigger><BreadcrumbEllipsis /></BreadcrumbItem>
        </BreadcrumbList>
      </div>
    </div>
  </div>
</template>
