import {cva, type VariantProps} from "workspace-packages/ui/utils"

export { default as InputGroup } from "#ui/components/input-group/InputGroup.vue"

export { default as InputGroupAddon } from "#ui/components/input-group/InputGroupAddon.vue"

export { default as InputGroupButton } from "#ui/components/input-group/InputGroupButton.vue"

export { default as InputGroupInput } from "#ui/components/input-group/InputGroupInput.vue"

export { default as InputGroupText } from "#ui/components/input-group/InputGroupText.vue"

export { default as InputGroupTextarea } from "#ui/components/input-group/InputGroupTextarea.vue"

export const inputGroupAddonVariants = cva(
  "bg-transparent text-foreground-muted flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
)

export type InputGroupVariants = VariantProps<typeof inputGroupAddonVariants>

export const inputGroupButtonVariants = cva(
  "text-sm shadow-none flex gap-2 items-center",
  {
    variants: {
      size: {
        "xs": "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
        "sm": "h-control-height px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5",
        "default": "h-control-height px-3 gap-1.5 rounded-md",
        "lg": "h-control-height-lg px-4 gap-1.5 rounded-md",
        "xl": "h-control-height-xl px-5 gap-2 rounded-md",
        "2xl": "h-control-height-2xl px-6 gap-2 rounded-md",
        "icon": "size-control-height p-0",
        "icon-lg": "size-control-height-lg p-0",
        "icon-xl": "size-control-height-xl p-0",
        "icon-2xl": "size-control-height-2xl p-0",
        "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
)

export type InputGroupButtonVariants = VariantProps<typeof inputGroupButtonVariants>
