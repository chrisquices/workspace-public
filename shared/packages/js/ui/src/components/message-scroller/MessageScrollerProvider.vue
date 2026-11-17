<script setup lang="ts">
import type { MessageScrollerProviderProps } from "#ui/components/message-scroller/useMessageScroller"
import { onMounted, watch } from "vue"
import { DEFAULTS, provideMessageScroller } from "#ui/components/message-scroller/useMessageScroller"

const props = withDefaults(defineProps<MessageScrollerProviderProps>(), {
  autoScroll: false,
  defaultScrollPosition: "end",
})

function resolved() {
  return {
    autoScroll: props.autoScroll ?? false,
    defaultScrollPosition: props.defaultScrollPosition ?? "end",
    scrollEdgeThreshold: props.scrollEdgeThreshold ?? DEFAULTS.scrollEdgeThreshold,
    scrollPreviousItemPeek: props.scrollPreviousItemPeek ?? DEFAULTS.scrollPreviousItemPeek,
    scrollMargin: props.scrollMargin ?? DEFAULTS.scrollMargin,
  }
}

const engine = provideMessageScroller(resolved())

watch(
  function () {
    return resolved()
  },
  function (next, prev) {
    engine.setProps(next)

    if (next.autoScroll !== prev?.autoScroll)
      engine.context.onAutoScrollChange()
  },
  { deep: true },
)

onMounted(function () {
  engine.context.applyDefaultScrollPosition()
})
</script>

<template>
  <slot />
</template>
