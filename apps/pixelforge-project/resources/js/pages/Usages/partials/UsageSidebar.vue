<script setup lang="ts">
import { Link } from "@inertiajs/vue3";
import { Gauge } from "@lucide/vue";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "workspace-packages/ui/sidebar";
import { index } from "@/actions/App/Http/Controllers/UsageController";
import { PageAside } from "@/components/Page";
</script>

<template>
    <PageAside class="border-b border-border lg:border-r lg:border-b-0">
        <Sidebar size="default" side="left" class="min-h-0 w-full lg:w-sidebar-width" collapsible="none">
            <SidebarHeader class="border-b border-border">
                <h2 class="flex items-center gap-2 font-medium">
                    <Gauge aria-hidden="true" />
                    <span>Usage</span>
                </h2>
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton as-child :is-active="$page.component === 'Usages/Index'">
                            <Link :href="index()" :aria-current="$page.component === 'Usages/Index' ? 'page' : undefined">
                                <Gauge aria-hidden="true" />
                                <span>Usage</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    </PageAside>
</template>

<style></style>
