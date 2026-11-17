import type { Ref } from "vue"
import { createContext } from "reka-ui"

export { default as Command } from "#ui/components/command/Command.vue"

export { default as CommandDialog } from "#ui/components/command/CommandDialog.vue"

export { default as CommandEmpty } from "#ui/components/command/CommandEmpty.vue"

export { default as CommandGroup } from "#ui/components/command/CommandGroup.vue"

export { default as CommandInput } from "#ui/components/command/CommandInput.vue"

export { default as CommandItem } from "#ui/components/command/CommandItem.vue"

export { default as CommandList } from "#ui/components/command/CommandList.vue"

export { default as CommandSeparator } from "#ui/components/command/CommandSeparator.vue"

export { default as CommandShortcut } from "#ui/components/command/CommandShortcut.vue"

export const [useCommand, provideCommandContext] = createContext<{
  allItems: Ref<Map<string, string>>
  allGroups: Ref<Map<string, Set<string>>>
  filterState: {
    search: string
    filtered: { count: number, items: Map<string, number>, groups: Set<string> }
  }
}>("Command")

export const [useCommandGroup, provideCommandGroupContext] = createContext<{
  id?: string
}>("CommandGroup")
