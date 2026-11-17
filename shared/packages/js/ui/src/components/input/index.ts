import { cva, type VariantProps } from "workspace-packages/ui/utils"

export { default as Input } from "#ui/components/input/Input.vue"

export const inputHeights = {
  '2xs': "h-control-height-2xs",
  xs: "h-control-height-xs",
  sm: "h-control-height-sm",
  default: "h-control-height",
  lg: "h-control-height-lg",
  xl: "h-control-height-xl",
  '2xl': "h-control-height-2xl",
} as const

export const inputSizes = {
  '2xs': `${inputHeights['2xs']} px-1.5 text-xs rounded-sm`,
  xs: `${inputHeights.xs} px-2 text-xs rounded-sm`,
  sm: `${inputHeights.sm} px-2 text-xs rounded-sm`,
  default: `${inputHeights.default} px-3 text-base md:text-sm rounded-sm`,
  lg: `${inputHeights.lg} px-4 text-base md:text-sm rounded-sm`,
  xl: `${inputHeights.xl} px-5 text-base rounded-sm`,
  '2xl': `${inputHeights['2xl']} px-6 text-base rounded-sm`,
} as const

export const inputVariants = cva(
  "file:text-foreground placeholder:text-foreground-muted selection:bg-primary selection:text-primary-foreground border-input-border w-full min-w-0 rounded-sm border bg-input noise-texture solid-surface py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-input file:noise-texture file:solid-surface file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      size: inputSizes,
    },
    defaultVariants: {
      size: "default",
    },
  },
)

export type InputVariants = VariantProps<typeof inputVariants>
