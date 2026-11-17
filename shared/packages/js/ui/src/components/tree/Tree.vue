<script setup lang="ts">
import {computed, onMounted, watch} from 'vue';
import type {PropType} from 'vue';
import {TreeRoot} from 'reka-ui';
import TreeNode from '#ui/components/tree/TreeNode.vue';

interface TreeItemData extends Record<string, unknown> {
  id: string;
  label: string;
  icon?: unknown;
  count?: number | string;
  defaultOpen?: boolean;
  selectionDisabled?: boolean;
  children?: TreeItemData[];
}

interface TreeState {
  treeItemsById: Map<string, TreeItemData>;
  defaultExpandedIds: string[];
}

const props = defineProps({
  nodes: {
    type: Array as PropType<TreeItemData[]>,
    default: function () {
      return [];
    },
  },
  defaultExpandedIds: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  persistenceKey: {
    type: String,
    default: undefined,
  },
});

const selectedNodeId = defineModel<string | undefined>('selectedNodeId');
const expandedIds = defineModel<string[] | undefined>('expandedIds');
const emit = defineEmits<{
  activate: [node: TreeItemData];
}>();

const treeState = computed(function () {
  const state: TreeState = {
    treeItemsById: new Map<string, TreeItemData>(),
    defaultExpandedIds: props.defaultExpandedIds ? props.defaultExpandedIds.slice() : [],
  };

  collectTreeState(props.nodes, 0, state, props.defaultExpandedIds === undefined);

  return state;
});

onMounted(function () {
  let initial = true;

  watch(function () {
    return props.persistenceKey;
  }, function (key) {

    // An explicitly supplied expansion model takes precedence on mount.
    const preserveModel = initial && expandedIds.value !== undefined;
    initial = false;
    if (!key || preserveModel) return;

    let restored = treeState.value.defaultExpandedIds.slice();

    try {
      const raw = window.localStorage.getItem(`workspace.tree.${key}.expanded`);
      const saved: unknown = raw === null ? undefined : JSON.parse(raw);

      if (Array.isArray(saved) && saved.every(function (id) {return typeof id === 'string';})) {
        restored = saved;
      }
    } catch {

      // Invalid or unavailable storage leaves the default expansion usable.
    }

    expandedIds.value = restored;
  }, {immediate: true, flush: 'sync'});

  watch(expandedIds, function (ids) {
    if (!props.persistenceKey || ids === undefined) return;

    try {
      window.localStorage.setItem(`workspace.tree.${props.persistenceKey}.expanded`, JSON.stringify(ids));
    } catch {

      // Persistence is optional; storage failures must not block interaction.
    }
  }, {deep: true, immediate: true, flush: 'post'});
});

const selectedModel = computed<TreeItemData | undefined>({
  get: function () {
    if (selectedNodeId.value == null) {
      return undefined;
    }

    return treeState.value.treeItemsById.get(selectedNodeId.value);
  },
  set: function (treeItem: TreeItemData | undefined) {
    selectedNodeId.value = treeItem?.id;
  },
});

function getKey(treeItem: TreeItemData) {
  return treeItem.id;
}

function getChildren(treeItem: TreeItemData) {
  if (treeItem.children && treeItem.children.length > 0) {
    return treeItem.children;
  }

  return undefined;
}

function collectTreeState(treeItems: TreeItemData[], depth: number, state: TreeState, includeDefaultExpandedIds: boolean) {
  for (const treeItem of treeItems) {
    const children = getChildren(treeItem);

    state.treeItemsById.set(treeItem.id, treeItem);

    if (children && includeDefaultExpandedIds && (treeItem.defaultOpen ?? depth === 0)) {
      state.defaultExpandedIds.push(treeItem.id);
    }

    if (children) {
      collectTreeState(children, depth + 1, state, includeDefaultExpandedIds);
    }
  }
}
</script>

<template>
  <TreeRoot
      v-slot="{ flattenItems }"
      v-model="selectedModel"
      v-model:expanded="expandedIds"
      :default-expanded="treeState.defaultExpandedIds"
      :items="nodes"
      :get-key="getKey"
      :get-children="getChildren"
      selection-behavior="replace"
  >
    <TransitionGroup name="tree-row" tag="div" class="flex flex-col gap-0">
      <TreeNode
          v-for="item in flattenItems"
          :key="item._id"
          :item="item"
          @activate="emit('activate', $event)"
      />
    </TransitionGroup>
  </TreeRoot>
</template>

<style>
.tree-row-enter-active,
.tree-row-leave-active {
  max-height: 2rem;
  overflow: hidden;
  transition: max-height 200ms ease-out,
  opacity 200ms ease-out,
  transform 200ms ease-out;
}

.tree-row-enter-from,
.tree-row-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-0.25rem);
}

.tree-row-enter-to,
.tree-row-leave-from {
  max-height: 2rem;
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .tree-row-enter-active,
  .tree-row-leave-active {
    transition: none;
  }
}
</style>
