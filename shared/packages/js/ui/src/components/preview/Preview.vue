<script setup lang="ts" generic="TFile extends PreviewFile">
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { computed } from 'vue';
import { Button } from 'workspace-packages/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'workspace-packages/ui/dialog';
import type { PreviewFile, PreviewProps } from '#ui/components/preview/types';

const props = defineProps<PreviewProps<TFile>>();
const open = defineModel<boolean>('open', { default: false });
const index = defineModel<number>('index', { default: 0 });

defineSlots<{
  default?: (props: { file: TFile; index: number }) => unknown;
  actions?: (props: { file: TFile; index: number }) => unknown;
}>();

const currentFile = computed(() => props.files[index.value]);
const canGoPrevious = computed(() => Boolean(currentFile.value) && index.value > 0);
const canGoNext = computed(() => Boolean(currentFile.value) && index.value < props.files.length - 1);

function navigate(direction: -1 | 1): void {
  if (!open.value || !(direction === -1 ? canGoPrevious.value : canGoNext.value)) {
    return;
  }

  index.value += direction;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }

  const target = event.target;

  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], audio, video')) {
    return;
  }

  event.preventDefault();
  navigate(event.key === 'ArrowLeft' ? -1 : 1);
}
</script>

<template>

  <!-- Preview Dialog -->
  <Dialog v-model:open="open">
    <DialogContent
      data-slot="preview"
      :show-close-button="false"
      class="pointer-events-auto inset-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/90 p-0 shadow-none duration-200 motion-reduce:animate-none sm:max-w-none"
      style="--tw-enter-scale: 1; --tw-exit-scale: 1"
      @keydown="handleKeydown"
      @click.self="open = false"
    >

      <!-- Header -->
      <DialogHeader class="pointer-events-auto h-topbar-height shrink-0 flex-row items-center justify-center border-b border-topbar-border bg-topbar px-4 text-topbar-foreground sm:text-center">
        <DialogTitle class="min-w-0 truncate text-center text-sm font-medium" :title="currentFile?.name">
          {{ currentFile?.name ?? 'Preview' }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          Use the left and right arrow keys to navigate files. Press Escape to close the preview.
        </DialogDescription>
      </DialogHeader>

      <!-- Media -->
      <div class="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2 sm:gap-4" @click.self="open = false">

        <!-- Previous File -->
        <Button
          variant="ghost"
          size="icon-lg"
          class="pointer-events-auto h-full w-topbar-height-lg rounded-none p-0 focus-visible:ring-inset active:scale-100 disabled:pointer-events-auto hover:bg-topbar"
          aria-label="Previous file"
          :disabled="!canGoPrevious"
          @click="navigate(-1)"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        <div :key="currentFile?.uid" class="pointer-events-auto flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden p-2 sm:p-topbar-height sm:pb-topbar-height" @click.self="open = false">
          <slot v-if="currentFile" :file="currentFile" :index="index" />
        </div>

        <!-- Next File -->
        <Button
          variant="ghost"
          size="icon-lg"
          class="pointer-events-auto h-full w-topbar-height-lg rounded-none p-0 focus-visible:ring-inset active:scale-100 disabled:pointer-events-auto hover:bg-topbar"
          aria-label="Next file"
          :disabled="!canGoNext"
          @click="navigate(1)"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <!-- Preview Footer -->
      <DialogFooter v-if="currentFile?.type === 'image' && $slots.actions" class="shrink-0 flex-row items-center justify-center px-4 pb-4 sm:justify-center sm:pb-topbar-height" @click.self="open = false">
        <div role="group" aria-label="Image actions" class="pointer-events-auto flex max-w-full shrink-0 flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-surface p-3 text-foreground">
          <slot name="actions" :file="currentFile" :index="index" />
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
