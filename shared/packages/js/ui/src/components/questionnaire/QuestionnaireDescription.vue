<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { ComponentPublicInstance, HTMLAttributes } from 'vue'
import { Primitive } from 'reka-ui'
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { cn } from 'workspace-packages/ui/utils'
import { injectQuestionnaireItemContext } from '#ui/components/questionnaire/useQuestionnaire'

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes['class']
  id?: string
}>(), {
  as: 'p',
})

const item = injectQuestionnaireItemContext()

const primitiveRef = ref<ComponentPublicInstance | null>(null)
const fallbackId = props.id ?? useId()
const descriptionId = ref(fallbackId)

let unregisterDescription = item.registerDescription(descriptionId.value)

onMounted(function () {

  // With `as-child` the rendered child can bring its own id, for example a

  // DialogDescription. Adopt it so both descriptions point at one element.
  const element = primitiveRef.value?.$el as HTMLElement | undefined
  const renderedId = element?.id

  if (!renderedId) {
    if (element) {
      element.id = fallbackId
    }

    return
  }

  if (renderedId !== descriptionId.value) {
    unregisterDescription()
    descriptionId.value = renderedId
    unregisterDescription = item.registerDescription(renderedId)
  }
})

onBeforeUnmount(function () {
  return unregisterDescription()
})
</script>

<template>
  <Primitive
    v-bind="props.asChild ? {} : { id: descriptionId }"
    ref="primitiveRef"
    data-slot="questionnaire-description"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('text-sm text-pretty text-foreground-muted', props.class)"
  >
    <slot />
  </Primitive>
</template>
