<script setup lang="ts">
import { File as FileIcon, Image as ImageIcon, Music2, Video as VideoIcon } from "@lucide/vue"
import type { PrimitiveProps } from "reka-ui"
import { Primitive } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { GridItemContentVariants } from "#ui/components/grid/index"
import { cn } from "workspace-packages/ui/utils"
import { gridItemContentVariants } from "#ui/components/grid/index"

interface Props extends PrimitiveProps {
  class?: HTMLAttributes["class"]
  aspect?: GridItemContentVariants["aspect"]
  mimeType?: string
  thumbnailUrl?: string | null
  animatedThumbnailUrl?: string | null
  alt?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  aspect: "square",
})
</script>

<template>
  <Primitive
      data-slot="grid-item-content"
      :as="props.as"
      :as-child="props.asChild"
      :type="!props.asChild && props.as === 'button' ? 'button' : undefined"
      :class="cn(gridItemContentVariants({ aspect: props.aspect }), props.class)"
  >
    <slot v-if="$slots.default" />
    <div v-else-if="props.mimeType?.startsWith('audio/')" class="flex size-full items-center justify-center">
      <Music2 class="size-6 text-foreground-muted" />
    </div>
    <video v-else-if="props.animatedThumbnailUrl" :src="props.animatedThumbnailUrl" :poster="props.thumbnailUrl ?? undefined" class="size-full object-cover" autoplay muted loop playsinline />
    <img v-else-if="props.thumbnailUrl" :src="props.thumbnailUrl" :alt="props.alt ?? ''" class="size-full object-cover" />
    <div v-else class="flex size-full items-center justify-center">
      <VideoIcon v-if="props.mimeType?.startsWith('video/')" class="size-6 text-foreground-muted" />
      <ImageIcon v-else-if="props.mimeType?.startsWith('image/')" class="size-6 text-foreground-muted" />
      <FileIcon v-else class="size-6 text-foreground-muted" />
    </div>
  </Primitive>
</template>
