import {cva, type VariantProps} from "workspace-packages/ui/utils"

export { default as Empty } from "#ui/components/empty/Empty.vue"

export { default as EmptyContent } from "#ui/components/empty/EmptyContent.vue"

export { default as EmptyDescription } from "#ui/components/empty/EmptyDescription.vue"

export { default as EmptyHeader } from "#ui/components/empty/EmptyHeader.vue"

export { default as EmptyMedia } from "#ui/components/empty/EmptyMedia.vue"

export { default as EmptyTitle } from "#ui/components/empty/EmptyTitle.vue"

export const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-surface-muted text-foreground flex size-12 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type EmptyMediaVariants = VariantProps<typeof emptyMediaVariants>
