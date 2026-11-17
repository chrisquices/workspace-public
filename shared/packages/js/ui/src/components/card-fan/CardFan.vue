<script setup lang="ts" generic="T">
import { computed } from "vue";
import { Badge } from "workspace-packages/ui/badge";
import { Card } from "workspace-packages/ui/card";

const props = withDefaults(defineProps<{
  items: T[];
  itemKey: (item: T) => string | number;
  showItemCount: boolean;
  visiblePreviews?: number | string;
  aspectRatio?: number;
}>(), {
  visiblePreviews: 5,
  aspectRatio: 1,
});

defineSlots<{
  default(props: { item: T; index: number }): unknown;
}>();

const cards = computed(function () {
  const requested = Number(props.visiblePreviews);
  const limit = Number.isFinite(requested) ? Math.min(9, Math.max(3, Math.floor(requested))) : 5;

  return props.items.slice(0, limit).map(function (item, index, items) {
    const offset = index - (items.length - 1) / 2;

    return {
      item: item,
      key: props.itemKey(item),
      index: index,
      depth: items.length - index,
      transform: `translate(-50%, -50%) translateX(${offset}%) rotate(${offset * 3}deg)`,
    };
  });
});
</script>

<template>
  <div data-slot="card-fan" class="relative isolate w-full shrink-0 select-none" :style="{aspectRatio: props.aspectRatio}">
    <TransitionGroup
      enter-active-class="transition-[opacity,scale,translate] duration-300 ease-out motion-reduce:transition-none"
      enter-from-class="translate-y-2 scale-95 opacity-0"
      leave-active-class="transition-[opacity,scale,translate] duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="translate-y-1 scale-95 opacity-0">
      <div v-for="card in cards" :key="card.key" class="pointer-events-none absolute inset-0" :style="{zIndex: card.depth}">
        <Card
          class="absolute left-1/2 origin-bottom gap-0 overflow-hidden rounded-lg border-border/80 p-0 transition-[transform,top,width,box-shadow] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          :class="props.items.length > 1 ? 'top-[43%] w-[68%] shadow-lg/10' : 'top-1/2 w-full shadow-none'"
          :style="{aspectRatio: props.aspectRatio, transform: card.transform}">
          <div
            class="absolute overflow-hidden rounded-sm bg-surface transition-[inset] duration-400 ease-out motion-reduce:transition-none"
            :class="props.items.length > 1 ? 'inset-1' : 'inset-0'">
            <slot :item="card.item" :index="card.index" />
          </div>
        </Card>
      </div>
    </TransitionGroup>
    <Badge v-if="props.showItemCount" variant="ghost" size="default" class="absolute left-0 top-0 z-10 bg-white font-mono font-semibold text-black">
      {{ props.items.length }}
    </Badge>
  </div>
</template>
