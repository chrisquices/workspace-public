import {cva, type VariantProps} from "workspace-packages/ui/utils"

export {default as Toggle} from "#ui/components/toggle/Toggle.vue"

export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "border tone-primary hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        secondary: "border tone-secondary hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        accent: "border tone-accent hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        success: "border tone-success hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        info: "border tone-info hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        warning: "border tone-warning hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        destructive: "border tone-destructive hover:brightness-90 brightness-50 data-[state=on]:brightness-100",
        outline: "border tone-outline hover:tone-outline-soft data-[state=on]:tone-outline-soft",
        input: "text-foreground border border-input-border bg-input noise-texture solid-surface shadow-xs font-normal justify-start brightness-50 data-[state=on]:brightness-100",
        ghost: "border tone-ghost brightness-50 data-[state=on]:brightness-100",
        link: "text-foreground border hover:text-foreground bg-transparent border-transparent hover:underline data-[state=on]:text-accent data-[state=on]:underline",
      },
      size: {
        "2xs": "h-control-height-2xs rounded-[4px] gap-1 px-1.5 has-[>svg]:px-1.5 text-xs [&_svg:not([class*='size-'])]:size-2.5",
        "icon-2xs": "size-control-height-2xs [&_svg:not([class*='size-'])]:size-2.5",
        "xs": "h-control-height-xs rounded-[6px] gap-1.5 px-2 has-[>svg]:px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        "sm": "h-control-height-sm rounded-md gap-1.5 px-3 has-[>svg]:px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        "default": "h-control-height px-3 py-2 has-[>svg]:px-3",
        "lg": "h-control-height-lg rounded-md px-4 has-[>svg]:px-4",
        "xl": "h-control-height-xl rounded-md px-5 has-[>svg]:px-5",
        "2xl": "h-control-height-2xl rounded-md px-6 has-[>svg]:px-6",
        "icon-xs": "size-control-height-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-control-height-sm [&_svg:not([class*='size-'])]:size-3",
        "icon": "size-control-height",
        "icon-lg": "size-control-height-lg",
        "icon-xl": "size-control-height-xl rounded-full",
        "icon-2xl": "size-control-height-2xl rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

export type ToggleVariants = VariantProps<typeof toggleVariants>
