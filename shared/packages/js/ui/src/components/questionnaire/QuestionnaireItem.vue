<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { AnswerControlRegistration, QuestionnaireItemStatus } from '#ui/components/questionnaire/useQuestionnaire'
import { computed, onBeforeUnmount, ref, shallowRef, useAttrs, watch } from 'vue'
import { cn } from 'workspace-packages/ui/utils'
import { compareDocumentOrder, getShortcutByChoiceValue, getShortcutKeys, injectQuestionnaireRootContext, isAnswerFilled, isEmptyNavigableInput, isRadioTarget, isTextEntryTarget, provideQuestionnaireItemContext } from '#ui/components/questionnaire/useQuestionnaire'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']

  /** Excludes the item from the questionnaire without unmounting it. */
  disabled?: boolean

  /** Marks the item invalid from outside, for example after schema validation. */
  invalid?: boolean

  /** Renders choices as checkboxes and keeps every selected answer. */
  multiple?: boolean

  /** Submitted under this name, and used to activate the item. */
  name: string

  /** Requires an answer before the questionnaire can continue. */
  required?: boolean
}>(), {
  disabled: false,
  invalid: false,
  multiple: false,
  required: false,
})

const emits = defineEmits<{
  'update:status': [status: QuestionnaireItemStatus]
}>()

const attrs = useAttrs()
const root = injectQuestionnaireRootContext()

const itemElement = ref<HTMLFieldSetElement | null>(null)
const answerControls = shallowRef<AnswerControlRegistration[]>([])
const selectedAnswerIds = ref<string[]>([])
const validationAttempted = ref(false)
const skipped = ref(false)
const resetVersion = ref(0)
const controlSyncVersion = ref(0)
const descriptionIds = ref<string[]>([])
const errorIds = ref<string[]>([])
const titleIds = ref<string[]>([])

let defaultSelectedAnswerIds: string[] = []

const active = computed(() => !props.disabled && root.activeItemName.value === props.name)
const orderedAnswerControls = computed(() => {

  // Re-sort whenever answers are added to or removed from the DOM.
  void root.domVersion.value

  return [...answerControls.value].sort(function (first, second) {
    return compareDocumentOrder(first.element, second.element)
  })
})
const answers = computed(() => orderedAnswerControls.value.filter(function (answer) {
  return !answer.disabled
}))
const answered = computed(() =>
  answers.value.some(function (answer) {
    return selectedAnswerIds.value.includes(answer.id)
  }))
const status = computed<QuestionnaireItemStatus>(() => {
  if (skipped.value) {
    return 'skipped'
  }

  return answered.value ? 'answered' : 'unanswered'
})
const intentionallySkipped = computed(() => status.value === 'skipped' && !props.required)
const valid = computed(() =>
  props.disabled
  || intentionallySkipped.value
  || (!props.invalid && status.value === 'answered'))
const invalid = computed(() =>
  !props.disabled
  && !intentionallySkipped.value
  && (props.invalid || (validationAttempted.value && !valid.value)))
const hasInputAnswer = computed(() => answers.value.some(function (answer) {
  return answer.type === 'input'
}))
const itemDefinition = computed(() => root.itemDefinitionByName.value?.get(props.name))
const shortcutByChoiceValue = computed(() =>
  root.itemDefinitionByName.value
    ? getShortcutByChoiceValue(itemDefinition.value, root.shortcuts.value)
    : null)
const shortcutByAnswerId = computed(() => {

  // Choice values from `items` take precedence, so shortcuts stay stable.
  if (shortcutByChoiceValue.value) {
    return new Map<string, string>()
  }

  const keys = getShortcutKeys(root.shortcuts.value)
  const shortcutAnswers = answers.value.filter(function (answer) {
    return answer.type === 'choice'
  })

  return new Map(
    shortcutAnswers
      .slice(0, keys.length)
      .flatMap(function (answer, index) {
        return (keys[index] ? [[answer.id, keys[index]!] as const] : [])
      }),
  )
})

// Only set when the title does not render as the legend, which already names

// the fieldset on its own.
const labelledBy = computed(() =>
  [...titleIds.value, attrs['aria-labelledby']].filter(Boolean).join(' ') || undefined)
const describedBy = computed(() =>
  [...descriptionIds.value, ...(invalid.value ? errorIds.value : []), attrs['aria-describedby']]
    .filter(Boolean)
    .join(' ') || undefined)
const keyShortcuts = computed(() =>
  [
    attrs['aria-keyshortcuts'],
    active.value ? 'Meta+Enter Control+Enter' : undefined,
    active.value && answers.value.length ? 'ArrowUp ArrowDown' : undefined,
    active.value && !root.first.value ? 'ArrowLeft' : undefined,
    active.value && !root.last.value && status.value !== 'unanswered' ? 'ArrowRight' : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined)

function updateAnswerSelected(answerId: string, selected: boolean) {
  if (!selected) {
    selectedAnswerIds.value = selectedAnswerIds.value.filter(function (current) {
      return current !== answerId
    })
    return
  }

  if (!props.multiple) {
    selectedAnswerIds.value = [answerId]
    return
  }

  if (!selectedAnswerIds.value.includes(answerId)) {
    selectedAnswerIds.value = [...selectedAnswerIds.value, answerId]
  }
}

function setAnswerSelectionFromInteraction(answerId: string, selected: boolean) {
  skipped.value = false
  updateAnswerSelected(answerId, selected)
}

function syncControlledAnswerSelection(answerId: string, selected: boolean) {
  if (selected) {
    skipped.value = false
  }

  updateAnswerSelected(answerId, selected)
}

function registerAnswerSelection(answerId: string, defaultSelected: boolean) {
  if (defaultSelected) {
    defaultSelectedAnswerIds = [
      ...defaultSelectedAnswerIds.filter(function (current) {
        return current !== answerId
      }),
      answerId,
    ]

    if (!props.multiple) {
      if (!selectedAnswerIds.value.length) {
        selectedAnswerIds.value = [answerId]
      }
    }
    else if (!selectedAnswerIds.value.includes(answerId)) {
      selectedAnswerIds.value = [...selectedAnswerIds.value, answerId]
    }
  }

  return function () {
    defaultSelectedAnswerIds = defaultSelectedAnswerIds.filter(function (current) {
      return current !== answerId
    })
    selectedAnswerIds.value = selectedAnswerIds.value.filter(function (current) {
      return current !== answerId
    })
  }
}

function setAnswerDefault(answerId: string, defaultSelected: boolean) {
  if (defaultSelected) {
    if (!defaultSelectedAnswerIds.includes(answerId)) {
      defaultSelectedAnswerIds = [...defaultSelectedAnswerIds, answerId]
    }

    return
  }

  defaultSelectedAnswerIds = defaultSelectedAnswerIds.filter(function (current) {
    return current !== answerId
  })
}

/**
 * Selecting a controlled choice clears the native checked state of the other
 * choices in the group, so every control re-syncs after an interaction the host
 * may have rejected.
 */
function requestControlSync() {
  controlSyncVersion.value += 1
}

function registerAnswerControl(registration: AnswerControlRegistration) {
  answerControls.value = [
    ...answerControls.value.filter(
      function (current) {
        return current.element !== registration.element && current.id !== registration.id
      },
    ),
    registration,
  ]

  return function () {
    answerControls.value = answerControls.value.filter(function (current) {
      return current !== registration
    })
  }
}

function registerDescription(descriptionId: string) {
  if (!descriptionIds.value.includes(descriptionId)) {
    descriptionIds.value = [...descriptionIds.value, descriptionId]
  }

  return function () {
    descriptionIds.value = descriptionIds.value.filter(function (current) {
      return current !== descriptionId
    })
  }
}

function registerTitle(titleId: string) {
  if (!titleIds.value.includes(titleId)) {
    titleIds.value = [...titleIds.value, titleId]
  }

  return function () {
    titleIds.value = titleIds.value.filter(function (current) {
      return current !== titleId
    })
  }
}

function registerError(errorId: string) {
  if (!errorIds.value.includes(errorId)) {
    errorIds.value = [...errorIds.value, errorId]
  }

  return function () {
    errorIds.value = errorIds.value.filter(function (current) {
      return current !== errorId
    })
  }
}

function validate() {
  validationAttempted.value = true

  if (!valid.value) {
    return false
  }

  if (!root.nativeValidation.value) {
    return true
  }

  const invalidAnswer = answers.value.find(
    function (answer) {
      return isAnswerFilled(answer) && answer.element.willValidate && !answer.element.validity.valid
    },
  )

  if (!invalidAnswer) {
    return true
  }

  invalidAnswer.element.focus()
  invalidAnswer.element.reportValidity()

  return false
}

function focus() {
  itemElement.value?.focus()
}

function focusInvalid() {
  const selectedInput = itemElement.value?.querySelector<HTMLInputElement>(
    'input[data-filled][name]:not(:disabled)',
  )
  const firstControl = itemElement.value?.querySelector<HTMLElement>(
    'input:not([type=hidden]):not(:disabled), textarea:not(:disabled)',
  )

  ;(selectedInput ?? firstControl ?? itemElement.value)?.focus()
}

function reset() {
  validationAttempted.value = false
  skipped.value = false
  selectedAnswerIds.value = props.multiple
    ? [...defaultSelectedAnswerIds]
    : defaultSelectedAnswerIds.slice(0, 1)
  resetVersion.value += 1
}

function skip() {
  if (props.required) {
    return
  }

  selectedAnswerIds.value = []
  skipped.value = true
}

function getAnswerByElement(element: Element) {
  return answers.value.find(function (answer) {
    return answer.element === element
  }) ?? null
}

function getAnswerByShortcut(shortcut: string) {
  if (shortcutByChoiceValue.value) {
    const choiceValue = Array.from(shortcutByChoiceValue.value.entries()).find(
      function ([, choiceShortcut]) {
        return choiceShortcut === shortcut
      },
    )?.[0]

    return (
      answers.value.find(function (answer) {
        return answer.type === 'choice' && answer.value === choiceValue
      }) ?? null
    )
  }

  const answerId = Array.from(shortcutByAnswerId.value.entries()).find(
    function ([, answerShortcut]) {
      return answerShortcut === shortcut
    },
  )?.[0]

  return answers.value.find(function (answer) {
    return answer.id === answerId
  }) ?? null
}

function moveAnswerFocus(currentElement: Element, direction: 'next' | 'previous') {
  const currentIndex = answers.value.findIndex(function (answer) {
    return answer.element === currentElement
  })
  const currentAnswer = currentIndex < 0 ? null : (answers.value[currentIndex] ?? null)

  if (
    !answers.value.length
    || (isTextEntryTarget(currentElement) && !isEmptyNavigableInput(currentAnswer))
    || (currentIndex < 0 && currentElement !== itemElement.value)
  ) {
    return false
  }

  const nextAnswer
    = currentIndex < 0
      ? (answers.value.find(isAnswerFilled)
        ?? (direction === 'next' ? answers.value[0] : answers.value[answers.value.length - 1]))
      : answers.value[
        (currentIndex + (direction === 'next' ? 1 : -1) + answers.value.length)
        % answers.value.length
      ]

  if (!nextAnswer || nextAnswer.element === currentElement) {
    return false
  }

  // Radio groups already move focus with the arrow keys.
  if (
    currentIndex >= 0
    && isRadioTarget(currentElement)
    && isRadioTarget(nextAnswer.element)
  ) {
    return false
  }

  nextAnswer.element.focus()

  if (nextAnswer.type === 'choice' && isRadioTarget(nextAnswer.element)) {
    nextAnswer.element.click()
  }

  return true
}

watch(status, function (nextStatus) {
  emits('update:status', nextStatus)
})

watch(function () {
  return props.multiple
}, function (multiple, wasMultiple) {
  if (!wasMultiple || multiple) {
    return
  }

  const selectedAnswer = answers.value.find(function (answer) {
    return selectedAnswerIds.value.includes(answer.id)
  })

  selectedAnswerIds.value = selectedAnswer ? [selectedAnswer.id] : []
})

let unregisterItem: (() => void) | null = null

watch([itemElement, function () {
  return props.name
}], function ([element, name]) {
  unregisterItem?.()
  unregisterItem = null

  if (!element) {
    return
  }

  unregisterItem = root.registerItem({
    element: element,
    focus: focus,
    focusInvalid: focusInvalid,
    getAnswerByElement: getAnswerByElement,
    getAnswerByShortcut: getAnswerByShortcut,
    getChoices: function () {
      return orderedAnswerControls.value.flatMap(function (answer) {
      return answer.type === 'choice' ? [{ disabled: answer.ownDisabled, value: answer.value }] : []
    })
    },
    isDisabled: function () {
      return props.disabled
    },
    isRequired: function () {
      return props.required
    },
    moveAnswerFocus: moveAnswerFocus,
    name: name,
    reset: reset,
    skip: skip,
    status: function () {
      return status.value
    },
    validate: validate,
  })
}, { flush: 'post' })

onBeforeUnmount(function () {
  unregisterItem?.()
  unregisterItem = null
})

provideQuestionnaireItemContext({
  active: active,
  controlSyncVersion: controlSyncVersion,
  disabled: computed(() => props.disabled),
  hasInputAnswer: hasInputAnswer,
  invalid: invalid,
  multiple: computed(() => props.multiple),
  name: computed(() => props.name),
  registerAnswerControl: registerAnswerControl,
  registerAnswerSelection: registerAnswerSelection,
  registerDescription: registerDescription,
  registerError: registerError,
  registerTitle: registerTitle,
  requestControlSync: requestControlSync,
  required: computed(() => props.required),
  resetVersion: resetVersion,
  selectedAnswerIds: selectedAnswerIds,
  setAnswerDefault: setAnswerDefault,
  setAnswerSelectionFromInteraction: setAnswerSelectionFromInteraction,
  shortcutByAnswerId: shortcutByAnswerId,
  shortcutByChoiceValue: shortcutByChoiceValue,
  shortcuts: root.shortcuts,
  status: status,
  syncControlledAnswerSelection: syncControlledAnswerSelection,
})
</script>

<template>
  <fieldset
    v-bind="attrs"
    ref="itemElement"
    data-slot="questionnaire-item"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :aria-keyshortcuts="keyShortcuts"
    :aria-labelledby="labelledBy"
    :data-active="active ? '' : undefined"
    :data-disabled="props.disabled ? '' : undefined"
    :data-invalid="invalid ? '' : undefined"
    :data-multiple="props.multiple ? '' : undefined"
    :data-required="props.required ? '' : undefined"
    :data-status="status"
    :disabled="props.disabled"
    :hidden="!active"
    :inert="!active"
    tabindex="-1"
    :class="cn('flex flex-col gap-4 min-w-0 border-0 p-0 outline-none', props.class)"
  >
    <slot :active="active" :invalid="invalid" :status="status" />
  </fieldset>
</template>
