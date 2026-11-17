import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "workspace-packages/ui/button"
import { buttonVariants } from "workspace-packages/ui/button"
import { cn } from "workspace-packages/ui/utils"

export interface SidebarProps {
  side?: "left" | "right"
  size?: "default" | "sm" | "icon"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
  position?: "fixed" | "sticky"
  class?: HTMLAttributes["class"]
}

export { default as Sidebar } from "#ui/components/sidebar/Sidebar.vue"

export { default as SidebarContent } from "#ui/components/sidebar/SidebarContent.vue"

export { default as SidebarFooter } from "#ui/components/sidebar/SidebarFooter.vue"

export { default as SidebarGroup } from "#ui/components/sidebar/SidebarGroup.vue"

export { default as SidebarGroupAction } from "#ui/components/sidebar/SidebarGroupAction.vue"

export { default as SidebarGroupContent } from "#ui/components/sidebar/SidebarGroupContent.vue"

export { default as SidebarGroupLabel } from "#ui/components/sidebar/SidebarGroupLabel.vue"

export { default as SidebarHeader } from "#ui/components/sidebar/SidebarHeader.vue"

export { default as SidebarInput } from "#ui/components/sidebar/SidebarInput.vue"

export { default as SidebarInset } from "#ui/components/sidebar/SidebarInset.vue"

export { default as SidebarMenu } from "#ui/components/sidebar/SidebarMenu.vue"

export { default as SidebarMenuAction } from "#ui/components/sidebar/SidebarMenuAction.vue"

export { default as SidebarMenuBadge } from "#ui/components/sidebar/SidebarMenuBadge.vue"

export { default as SidebarMenuButton } from "#ui/components/sidebar/SidebarMenuButton.vue"

export { default as SidebarMenuItem } from "#ui/components/sidebar/SidebarMenuItem.vue"

export { default as SidebarMenuSkeleton } from "#ui/components/sidebar/SidebarMenuSkeleton.vue"

export { default as SidebarMenuSub } from "#ui/components/sidebar/SidebarMenuSub.vue"

export { default as SidebarMenuSubButton } from "#ui/components/sidebar/SidebarMenuSubButton.vue"

export { default as SidebarMenuSubItem } from "#ui/components/sidebar/SidebarMenuSubItem.vue"

export { default as SidebarProvider } from "#ui/components/sidebar/SidebarProvider.vue"

export { default as SidebarRail } from "#ui/components/sidebar/SidebarRail.vue"

export { default as SidebarSeparator } from "#ui/components/sidebar/SidebarSeparator.vue"

export { default as SidebarTrigger } from "#ui/components/sidebar/SidebarTrigger.vue"

export { useSidebar } from "#ui/components/sidebar/utils"

const sidebarMenuButtonBase = [
  "peer/menu-button relative mx-2 select-none justify-start overflow-hidden text-left",
  "motion-reduce:transition-none focus-visible:ring-inset",
  "aria-disabled:pointer-events-none aria-disabled:opacity-50",
  "group-has-data-[sidebar=menu-action]/menu-item:pr-8",
  "[[data-slot=sidebar-menu-item]:has(>[data-slot=sidebar-menu-badge])>&:not([data-size=icon])]:pr-8",
  "[[data-slot=sidebar-menu-item]:has(>[data-slot=sidebar-menu-badge]):has(>[data-slot=sidebar-menu-action])>&:not([data-size=icon])]:pr-16",
  "group-data-[collapsible=icon]:px-2.5!",
  "[&>span:last-child]:flex-1 [&>span:last-child]:truncate",
]

export type SidebarMenuButtonVariants = Omit<ButtonVariants, "variant"> & {
  variant?: ButtonVariants["variant"] | "default"
  isActive?: boolean
}

export function sidebarMenuButtonVariants({
  variant = "default",
  size = "default",
  isActive = false,
}: SidebarMenuButtonVariants = {}) {
  return cn(
    buttonVariants({ variant: variant === "default" ? (isActive ? "secondary" : "ghost") : variant, size: size }),
    sidebarMenuButtonBase,
    !size?.startsWith("icon") && "w-[calc(100%-1rem)]",
    variant === "default" && !isActive && "text-foreground-muted",
    size?.startsWith("icon") && [
      "mx-auto w-auto aspect-square justify-center px-0",
      "group-has-data-[sidebar=menu-action]/menu-item:pr-0",
      "group-data-[collapsible=icon]:w-auto! group-data-[collapsible=icon]:px-0!",
    ],
  )
}
