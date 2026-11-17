import {cva} from "workspace-packages/ui/utils"

export { default as NavigationMenu } from "#ui/components/navigation-menu/NavigationMenu.vue"

export { default as NavigationMenuContent } from "#ui/components/navigation-menu/NavigationMenuContent.vue"

export { default as NavigationMenuIndicator } from "#ui/components/navigation-menu/NavigationMenuIndicator.vue"

export { default as NavigationMenuItem } from "#ui/components/navigation-menu/NavigationMenuItem.vue"

export { default as NavigationMenuLink } from "#ui/components/navigation-menu/NavigationMenuLink.vue"

export { default as NavigationMenuList } from "#ui/components/navigation-menu/NavigationMenuList.vue"

export { default as NavigationMenuTrigger } from "#ui/components/navigation-menu/NavigationMenuTrigger.vue"

export { default as NavigationMenuViewport } from "#ui/components/navigation-menu/NavigationMenuViewport.vue"

export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-control-height w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=open]:hover:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:focus:bg-accent data-[state=open]:bg-accent/50 focus-visible:ring-ring/50 outline-none transition-[color,box-shadow] focus-visible:ring-3 focus-visible:outline-1",
)
