<script setup lang="ts">
import {computed} from 'vue';
import {ChevronRight} from '@lucide/vue';
import {TreeItem} from 'reka-ui';
import type {FlattenedItem, TreeItemSelectEvent} from 'reka-ui';
import {sidebarMenuButtonVariants} from '#ui/components/sidebar/index';
import {cn} from 'workspace-packages/ui/utils';
import {Button} from 'workspace-packages/ui/button';

defineOptions({name: 'TreeNode'});

interface TreeItemData extends Record<string, unknown> {
  id: string;
  label: string;
  icon?: unknown;
  count?: number | string;
  defaultOpen?: boolean;
  selectionDisabled?: boolean;
  children?: TreeItemData[];
}

const props = defineProps<{
  item: FlattenedItem<TreeItemData>;
}>();
const emit = defineEmits<{ activate: [node: TreeItemData] }>();

const node = computed(function () {
  return props.item.value;
});
const paddingLeft = computed(function () {
  return `calc(var(--spacing) * 3 + ${(props.item.level - 1) * 1.25}rem)`;
});

function activateNode(event: TreeItemSelectEvent<TreeItemData>): void {
  if (node.value.selectionDisabled) {
    event.preventDefault();

    return;
  }

  if (event.detail.originalEvent.type === 'click' && event.detail.originalEvent.detail > 1) {
    event.preventDefault();

    return;
  }

  emit('activate', node.value);
}

function preventRowToggle(event: CustomEvent<{ originalEvent: Event }>): void {
  if (event.detail.originalEvent.type === 'click') {
    event.preventDefault();
  }
}
</script>

<template>
  <TreeItem
      v-slot="{ isSelected, isExpanded, isDisabled, handleToggle }"
      v-bind="item.bind"
      as-child
      @select="activateNode"
      @toggle="preventRowToggle"
  >
    <li
        :data-tree-id="node.id"
        :aria-disabled="node.selectionDisabled || undefined"
        :style="{ paddingLeft }"
        :class="cn(sidebarMenuButtonVariants({ isActive: isSelected }), 'group gap-2 border-0 pr-1!', node.selectionDisabled && 'cursor-not-allowed opacity-50 aria-disabled:pointer-events-auto')"
        @dblclick.stop="item.hasChildren && !isDisabled && handleToggle()"
    >
      <span
          v-for="depthLineIndex in item.level - 1"
          :key="depthLineIndex"
          aria-hidden="true"
          class="absolute inset-y-0 w-px bg-foreground-muted/20"
          :style="{ left: `${1.1875 + (depthLineIndex - 1) * 1.25}rem` }"
      ></span>

      <component :is="node.icon" v-if="node.icon" class="size-4 shrink-0"/>
      <span class="flex-1 truncate">{{ node.label }}</span>
      <small v-if="node.count !== undefined" class="shrink-0 text-xs text-foreground-subtle">{{ node.count }}</small>

      <Button
          v-if="item.hasChildren"
          type="button"
          variant="ghost"
          size="icon-2xs"
          :tabindex="-1"
          :disabled="isDisabled"
          :aria-label="`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`"
          :aria-expanded="isExpanded"
          @pointerdown.stop.prevent
          @click.stop="handleToggle"
          @dblclick.stop
      >
        <ChevronRight
            aria-hidden="true"
            class="size-3 shrink-0 transition-transform duration-100 group-data-[expanded]:rotate-90 text-foreground-subtle stroke-2"
        />
      </Button>
    </li>
  </TreeItem>
</template>
