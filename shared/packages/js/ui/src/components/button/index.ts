import {cva, type VariantProps} from "workspace-packages/ui/utils"

export {default as Button} from "#ui/components/button/Button.vue"

export const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center gap-1.5 active:scale-95 active:brightness-90 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        primary: "border tone-primary hover:brightness-90",
        secondary: "border tone-secondary hover:brightness-90",
        accent: "border tone-accent hover:brightness-90",
        success: "border tone-success hover:brightness-90",
        info: "border tone-info hover:brightness-90",
        warning: "border tone-warning hover:brightness-90",
        destructive: "border tone-destructive hover:brightness-90",
        outline: "border tone-outline hover:tone-outline-soft",
        input: "text-foreground border border-input-border bg-input noise-texture solid-surface shadow-xs font-normal justify-start",
        ghost: "border tone-ghost",
        link: "text-foreground border hover:text-foreground bg-transparent border-transparent",
      },
      size: {
        "2xs": "h-control-height-2xs rounded-[4px] gap-1 px-1.5 has-[>svg]:px-1.5 text-xs [&_svg:not([class*='size-'])]:size-2.5",
        "xs": "h-control-height-xs rounded-[6px] gap-1.5 px-2 has-[>svg]:px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        "sm": "h-control-height-sm rounded-md gap-1.5 px-3 has-[>svg]:px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        "default": "h-control-height rounded-md px-4 py-2 has-[>svg]:px-4",
        "lg": "h-control-height-lg rounded-md px-4 has-[>svg]:px-4",
        "xl": "h-control-height-xl rounded-md px-5 has-[>svg]:px-5",
        "2xl": "h-control-height-2xl rounded-md px-6 has-[>svg]:px-6",
        "icon-2xs": "size-control-height-2xs [&_svg:not([class*='size-'])]:size-2.5 rounded-md",
        "icon-xs": "size-control-height-xs [&_svg:not([class*='size-'])]:size-3 rounded-md",
        "icon-sm": "size-control-height-sm [&_svg:not([class*='size-'])]:size-3 rounded-md",
        "icon": "size-control-height rounded-md",
        "icon-lg": "size-control-height-lg rounded-full",
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

export type ButtonVariants = VariantProps<typeof buttonVariants>
