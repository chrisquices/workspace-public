import {cva, type VariantProps} from "workspace-packages/ui/utils"

export { default as Grid } from "#ui/components/grid/Grid.vue"

export { default as GridItem } from "#ui/components/grid/GridItem.vue"

export { default as GridItemAction } from "#ui/components/grid/GridItemAction.vue"

export { default as GridItemActionRemove } from "#ui/components/grid/GridItemActionRemove.vue"

export { default as GridItemContent } from "#ui/components/grid/GridItemContent.vue"

export { default as GridItemLabel } from "#ui/components/grid/GridItemLabel.vue"

export { default as GridItemOverlay } from "#ui/components/grid/GridItemOverlay.vue"

export const gridVariants = cva(
  "min-w-0 outline-none",
  {
    variants: {
      gap: {
        sm: "gap-2",
        md: "gap-4",
        lg: "gap-6",
      },
      virtualized: {
        true: "relative",
        false: "grid",
      },
    },
    defaultVariants: {
      gap: "md",
      virtualized: false,
    },
  },
)

export type GridVariants = VariantProps<typeof gridVariants>

export const gridItemVariants = cva(
  "group/grid-item block w-full min-w-0 overflow-hidden rounded-lg bg-surface noise-texture solid-surface p-0 text-left text-foreground",
  {
    variants: {
      interactive: {
        true: "cursor-pointer transition-[border-color,box-shadow,filter] duration-75 focus-visible:outline-none",
        false: "",
      },
      selected: {
        true: "ring-2 ring-accent/10",
        false: "",
      },
      highlighted: {
          true: "ring-2 ring-accent/80",
        false: "",
      },
      inert: {
        true: "cursor-not-allowed opacity-50",
        false: "",
      },
      virtualized: {
        true: "absolute left-0 top-0",
        false: "relative",
      },
    },
    defaultVariants: {
      interactive: false,
      selected: false,
      highlighted: false,
      inert: false,
      virtualized: false,
    },
  },
)

export type GridItemVariants = VariantProps<typeof gridItemVariants>

export const gridItemContentVariants = cva(
  "relative w-full overflow-hidden bg-input noise-texture solid-surface",
  {
    variants: {
      aspect: {
        square: "aspect-square",
        portrait: "aspect-[3/4]",
        landscape: "aspect-[4/3]",
        wide: "aspect-video",
      },
    },
    defaultVariants: {
      aspect: "square",
    },
  },
)

export type GridItemContentVariants = VariantProps<typeof gridItemContentVariants>

export const gridItemLabelVariants = cva(
  "min-w-0 text-xs font-medium",
  {
    variants: {
      variant: {
        overlay: "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-overlay/90 via-overlay/50 to-transparent px-3 pb-2 pt-10 text-white",
        below: "relative z-20 border-t border-border px-3 py-3 text-foreground",
      },
    },
    defaultVariants: {
      variant: "overlay",
    },
  },
)

export type GridItemLabelVariants = VariantProps<typeof gridItemLabelVariants>

export const gridItemOverlayVariants = cva(
  "absolute inset-0 z-10 group-hover/grid-item:bg-overlay/10 duration-100 transition-all",
  {
    variants: {
      variant: {
        transparent: "",
        scrim: "bg-overlay/25",
      },
      visibility: {
        always: "",
        hover: "opacity-0 transition-opacity duration-100 group-hover/grid-item:opacity-100 group-focus-within/grid-item:opacity-100",
      },
    },
    defaultVariants: {
      variant: "transparent",
      visibility: "always",
    },
  },
)

export type GridItemOverlayVariants = VariantProps<typeof gridItemOverlayVariants>
