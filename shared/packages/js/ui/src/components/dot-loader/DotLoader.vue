<script setup lang="ts">
import type {HTMLAttributes} from "vue"
import {computed, onBeforeUnmount, ref, watch} from "vue"
import {dots, subscribeDotLoader} from "#ui/components/dot-loader/animation"
import {cn} from "workspace-packages/ui/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  label?: string
  viewBox?: string
  startAtEdge?: boolean
}>(), {
  label: "Loading",
  viewBox: "10 10 260 260",
})

const gridDots = computed(function () {
  if (props.viewBox === '10 10 260 260') return dots

  const [left, top, width, height] = props.viewBox.trim().split(/[\s,]+/).map(Number)
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return dots

  const columns = Math.ceil(width / 10) + 1
  const rows = Math.ceil(height / 10) + 1
  return Array.from({length: columns * rows}, function (_, index) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = column / (columns - 1)
    const y = row / (rows - 1)
    const radius = Math.hypot(x * 2 - 1, y * 2 - 1)
    const edge = Math.max(0, Math.min(1, (radius - 0.55) / (Math.SQRT2 - 0.55)))
    return {
      cx: left + x * width,
      cy: top + y * height,
      x: x,
      y: y,
      vignette: 1 - 0.3 * edge * edge * (3 - 2 * edge),
    }
  })
})

const element = ref<SVGSVGElement | null>(null)
let unsubscribe: (() => void) | undefined

watch([element, gridDots, () => props.startAtEdge], function () {
  unsubscribe?.()
  if (!element.value) return

  const circles = element.value.querySelectorAll('circle')
  unsubscribe = subscribeDotLoader(element.value, function (opacities) {
    circles.forEach(function (circle, index) {
      circle.setAttribute('opacity', opacities[index])
    })
  }, gridDots.value, props.startAtEdge)
}, {flush: 'post'})

onBeforeUnmount(function () {
  unsubscribe?.()
})
</script>

<template>
  <svg
    ref="element"
    data-slot="dot-loader"
    :viewBox="props.viewBox"
    role="status"
    :aria-label="props.label"
    :class="cn('pointer-events-none block size-full text-foreground', props.class)"
  >
    <circle v-for="(dot, index) in gridDots" :key="index" :cx="dot.cx" :cy="dot.cy" r="0.5" fill="currentColor" opacity="0" />
  </svg>
</template>
