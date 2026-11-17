import type { InjectionKey, Ref } from "vue"
import type { InputVariants } from "workspace-packages/ui/input"

export const inputGroupSizeKey = Symbol("inputGroupSize") as InjectionKey<Ref<InputVariants["size"]>>
