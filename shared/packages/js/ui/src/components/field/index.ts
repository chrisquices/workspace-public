import {cva, type VariantProps} from "workspace-packages/ui/utils"

export const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
  },
)

export type FieldVariants = VariantProps<typeof fieldVariants>

export { default as Field } from "#ui/components/field/Field.vue"

export { default as FieldContent } from "#ui/components/field/FieldContent.vue"

export { default as FieldDescription } from "#ui/components/field/FieldDescription.vue"

export { default as FieldError } from "#ui/components/field/FieldError.vue"

export { default as FieldGroup } from "#ui/components/field/FieldGroup.vue"

export { default as FieldLabel } from "#ui/components/field/FieldLabel.vue"

export { default as FieldLegend } from "#ui/components/field/FieldLegend.vue"

export { default as FieldSeparator } from "#ui/components/field/FieldSeparator.vue"

export { default as FieldSet } from "#ui/components/field/FieldSet.vue"

export { default as FieldTitle } from "#ui/components/field/FieldTitle.vue"
