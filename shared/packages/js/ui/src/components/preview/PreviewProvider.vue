<script setup lang="ts">
import { Expand, File, FlipHorizontal, FlipVertical, Image, Maximize, Minimize, Minus, Music, Plus, RotateCcw, RotateCw, Scaling, Undo2, Video } from '@lucide/vue';
import { computed, reactive, ref, shallowRef, toValue, triggerRef, watch } from 'vue';
import { useObjectUrl } from '@vueuse/core';
import type { AudioConfig } from 'workspace-packages/ui-engines/audio';
import { createImage } from 'workspace-packages/ui-engines/image';
import type { ImageEngine } from 'workspace-packages/ui-engines/image';
import type { VideoConfig } from 'workspace-packages/ui-engines/video';
import { Button } from 'workspace-packages/ui/button';
import { ButtonGroup, ButtonGroupText } from 'workspace-packages/ui/button-group';
import { Card } from 'workspace-packages/ui/card';
import { MusicPlayer } from 'workspace-packages/ui/music-player';
import { Spinner } from 'workspace-packages/ui/spinner';
import { VideoPlayer } from 'workspace-packages/ui/video-player';
import Preview from '#ui/components/preview/Preview.vue';
import { providePreviewContext } from '#ui/components/preview/utils';
import type { PreviewFile, PreviewSource } from '#ui/components/preview/types';

defineSlots<{
  default?: () => unknown;
  media?: (props: { file: PreviewFile; index: number }) => unknown;
}>();

// region --- Preview --------------------------------------------------------------------------------------------------
const mediaIcons = { image: Image, video: Video, audio: Music, file: File };

const preview = reactive({
  isOpen: false,
  source: function (): readonly PreviewFile[] {
    return [];
  },
  currentUid: null as string | null,

  get files(): readonly PreviewFile[] {
    return this.source();
  },

  get index(): number {
    const currentPreview = this;
    return this.files.findIndex(function (file) {
      return file.uid === currentPreview.currentUid;
    });
  },

  set index(index: number) {
    const file = this.files[index];

    if (file) {
      this.currentUid = file.uid;
    }
  },

  open(source: PreviewSource, uid: string): void {
    if (!toValue(source).some(function (file) {
      return file.uid === uid;
    })) {
      return;
    }

    this.source = function () {
      return toValue(source);
    };
    this.currentUid = uid;
    this.isOpen = true;
  },

  close(): void {
    this.isOpen = false;
  },
});

const videoConfig: Partial<VideoConfig> = { persistSettings: {enabled: true} };
const audioConfig = computed<Partial<AudioConfig>>(() => ({
  audioId: `preview-${preview.currentUid}`,
  playback: {autoplay: {enabled: true}},
  persistSettings: {enabled: true},
}));

const currentFile = computed(() => preview.files[preview.index]);
const objectUrl = useObjectUrl(function () {
  const source = currentFile.value?.src;
  return source instanceof Blob ? source : undefined;
});
const mediaSource = computed(() => {
  const source = currentFile.value?.src;
  return typeof source === 'string' ? source : objectUrl.value;
});
const mediaSources = computed(() => mediaSource.value ? [{ src: mediaSource.value }] : []);

const imageViewport = ref<HTMLElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const imageEngine = shallowRef<ImageEngine | null>(null);
const imageState = computed(() => imageEngine.value?.getState());
let imageBackgroundPointer: { id: number; x: number; y: number } | null = null;

// Keep the fitted image and toolbar until the closing dialog actually unmounts.
watch([imageViewport, imageElement, mediaSource], function ([viewport, image, src], _, onCleanup) {
  if (!viewport || !image || !src) return;

  const engine = createImage({
    element: image,
    config: {
      src: src,
      viewport: {element: viewport},
      events: {
        onChange: function () {
          return triggerRef(imageEngine);
        },
      },
    },
  });

  imageEngine.value = engine;
  onCleanup(function () {
    engine.destroy();
    imageEngine.value = null;
    imageBackgroundPointer = null;
  });
}, { flush: 'post' });

// Pointer capture can retarget image clicks to the viewport, so track where the press began.
function handleImagePointerDown(event: PointerEvent): void {
  imageBackgroundPointer = event.isPrimary && event.button === 0 && event.target === event.currentTarget
    ? { id: event.pointerId, x: event.clientX, y: event.clientY }
    : null;
}

function handleImagePointerMove(event: PointerEvent): void {
  if (imageBackgroundPointer?.id === event.pointerId && Math.hypot(event.clientX - imageBackgroundPointer.x, event.clientY - imageBackgroundPointer.y) > 8) {
    imageBackgroundPointer = null;
  }
}

function handleImageClick(event: MouseEvent): void {
  const pointer = imageBackgroundPointer;
  const viewport = imageViewport.value;
  imageBackgroundPointer = null;

  if (!pointer || !viewport || event.defaultPrevented) return;

  if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8 || viewport.ownerDocument.elementFromPoint(event.clientX, event.clientY) !== viewport) {
    return;
  }

  preview.close();
}

watch(function () {
  return preview.index;
}, function (index) {
  if (index < 0) {
    preview.close();
  }
});

providePreviewContext(preview);

// endregion
</script>

<template>
  <slot />

  <!-- File Preview -->
  <Preview v-model:open="preview.isOpen" v-model:index="preview.index" :files="preview.files">
    <template #default="{ file, index }">
      <slot name="media" :file="file" :index="index">

        <!-- Image Viewport -->
        <div
          v-if="file.type === 'image'"
          ref="imageViewport"
          tabindex="0"
          :aria-label="`Image preview: ${file.name}`"
          class="relative size-full touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          @pointerdown.capture="handleImagePointerDown"
          @pointermove.capture="handleImagePointerMove"
          @pointercancel.capture="imageBackgroundPointer = null"
          @click="handleImageClick"
        >
          <img
            ref="imageElement"
            :alt="file.name"
            draggable="false"
            class="absolute left-1/2 top-1/2 max-w-none select-none"
            :style="{ transform: `translate(-50%, -50%) ${imageState?.transform ?? ''}`, transformOrigin: 'center center' }"
          />

          <!-- Image Loading -->
          <div v-if="imageState?.loading" role="status" class="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
            <Spinner class="size-8" aria-hidden="true" />
            <span class="sr-only">Loading image</span>
          </div>

          <!-- Image Error -->
          <div v-if="imageState?.error" role="alert" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 p-4 text-center" @pointerdown.stop>
            <p>{{ imageState.error }}</p>

            <!-- Retry -->
            <Button variant="secondary" size="sm" @click="imageEngine?.retry()">
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>

        <!-- Video Player -->
        <VideoPlayer
          v-else-if="file.type === 'video'"
          :key="file.uid"
          :player-id="`preview-${file.uid}`"
          :config="videoConfig"
          :sources="mediaSources"
          :poster="file.thumbnailUrl ?? undefined"
          class="aspect-auto h-full max-h-full [&_video]:object-contain"
        />

        <!-- Music Player -->
        <Card v-else-if="file.type === 'audio'" class="max-w-full p-4 sm:p-6" @keydown.left.stop @keydown.right.stop>
          <MusicPlayer
            :key="file.uid"
            size="square"
            :title="file.name"
            :config="audioConfig"
            :sources="mediaSources"
            :artwork="file.thumbnailUrl ? [{ src: file.thumbnailUrl, type: 'image/webp' }] : []"
          />
        </Card>
        <img v-else-if="file.thumbnailUrl" :src="file.thumbnailUrl" :alt="file.name" class="max-h-full max-w-full object-contain" />
        <component v-else :is="mediaIcons[file.type ?? 'file']" class="size-16 text-foreground-muted" aria-hidden="true" />
      </slot>
    </template>

    <template v-if="imageEngine" #actions>

      <!-- Image Zoom -->
      <ButtonGroup aria-label="Image zoom">

        <!-- Zoom Out -->
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" :disabled="!imageState?.loaded || !imageState.canZoomOut" @click="imageEngine.zoomOut()">
          <Minus aria-hidden="true" />
        </Button>
        <ButtonGroupText class="min-w-14 justify-center text-xs tabular-nums">{{ imageState?.zoomPercent ?? 0 }}%</ButtonGroupText>

        <!-- Zoom In -->
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" :disabled="!imageState?.loaded || !imageState.canZoomIn" @click="imageEngine.zoomIn()">
          <Plus aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <!-- Image Fit -->
      <ButtonGroup aria-label="Image fit">

        <!-- Fit -->
        <Button :variant="imageState?.fitMode === 'contain' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="imageState?.fitMode === 'contain'" :disabled="!imageState?.loaded" @click="imageEngine.config.viewport.fit = 'contain'">
          <Minimize aria-hidden="true" />
          Fit
        </Button>

        <!-- Fill -->
        <Button :variant="imageState?.fitMode === 'cover' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="imageState?.fitMode === 'cover'" :disabled="!imageState?.loaded" @click="imageEngine.config.viewport.fit = 'cover'">
          <Expand aria-hidden="true" />
          Fill
        </Button>

        <!-- 1:1 -->
        <Button :variant="imageState?.fitMode === 'actual' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="imageState?.fitMode === 'actual'" :disabled="!imageState?.loaded" @click="imageEngine.config.viewport.fit = 'actual'">
          <Scaling aria-hidden="true" />
          1:1
        </Button>
      </ButtonGroup>

      <!-- Image Rotation -->
      <ButtonGroup aria-label="Image rotation">

        <!-- Rotate Counter-Clockwise -->
        <Button variant="ghost" size="icon-sm" aria-label="Rotate counter-clockwise" title="Rotate counter-clockwise" :disabled="!imageState?.loaded" @click="imageEngine.rotateCounterClockwise()">
          <RotateCcw aria-hidden="true" />
        </Button>

        <!-- Rotate Clockwise -->
        <Button variant="ghost" size="icon-sm" aria-label="Rotate clockwise" title="Rotate clockwise" :disabled="!imageState?.loaded" @click="imageEngine.rotateClockwise()">
          <RotateCw aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <!-- Image Flip -->
      <ButtonGroup aria-label="Image flip">

        <!-- Flip Horizontal -->
        <Button variant="ghost" size="icon-sm" aria-label="Flip horizontal" title="Flip horizontal" :aria-pressed="imageState?.flipX" :disabled="!imageState?.loaded" @click="imageEngine.toggleFlipHorizontal()">
          <FlipHorizontal aria-hidden="true" />
        </Button>

        <!-- Flip Vertical -->
        <Button variant="ghost" size="icon-sm" aria-label="Flip vertical" title="Flip vertical" :aria-pressed="imageState?.flipY" :disabled="!imageState?.loaded" @click="imageEngine.toggleFlipVertical()">
          <FlipVertical aria-hidden="true" />
        </Button>
      </ButtonGroup>

      <!-- Reset Image View -->
      <Button variant="ghost" size="icon-sm" aria-label="Reset view" title="Reset view" :disabled="!imageState?.loaded" @click="imageEngine.reset()">
        <Undo2 aria-hidden="true" />
      </Button>

      <!-- Image Fullscreen -->
      <Button variant="ghost" size="icon-sm" :aria-label="imageState?.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'" title="Toggle fullscreen" :disabled="!imageState?.fullscreenSupported" @click="imageEngine.toggleFullscreen()">
        <Maximize aria-hidden="true" />
      </Button>
    </template>
  </Preview>
</template>
