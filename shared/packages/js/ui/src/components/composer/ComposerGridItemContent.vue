<script setup lang="ts">
import type { Component, HTMLAttributes } from "vue"
import { GridItemContent } from "workspace-packages/ui/grid"
import { cn } from "workspace-packages/ui/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  videoSrc?: string | null
  poster?: string | null
  imageSrc?: string | null
  alt?: string
  fallbackIcon?: Component
}>(), {
  alt: "",
})
</script>

<template>

</template>
