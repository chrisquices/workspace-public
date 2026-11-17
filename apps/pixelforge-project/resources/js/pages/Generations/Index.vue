<script setup lang="ts">
import { Head, usePoll } from "@inertiajs/vue3";
import { LibraryBig } from "@lucide/vue";
import { useMediaQuery, useMounted, useStorage } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";
import { Slider } from "workspace-packages/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "workspace-packages/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "workspace-packages/ui/tooltip";
import { Page, PageAside, PageMain, PageSection, PageSectionContent, PageSectionHeading, PageSectionHeadingActions, PageSectionHeadingTitle } from "@/components/Page";
import EmptyLibrary from "@/pages/Generations/partials/EmptyLibrary.vue";
import DeleteGenerationDialog from "@/pages/Generations/partials/DeleteGenerationDialog.vue";
import GenerationDetailsDialog from "@/pages/Generations/partials/GenerationDetailsDialog.vue";
import LibraryItems from "@/pages/Generations/partials/LibraryItems.vue";
import PromptSidebar from "@/pages/Generations/partials/PromptSidebar.vue";
import type { Generation, GenerationFilters } from "@/types/generation";

const props = defineProps<{
    generations: Generation[]
    filters: GenerationFilters
}>();

const mobileView = ref("create");
const gridSize = useStorage<number[]>("pixel.library.grid-size", [14], undefined, {
    initOnMounted: true,
});
const desktopLayout = useMediaQuery("(min-width: 1024px)");
const displayedGridSize = computed({
    get(): number[] {
        const size = gridSize.value[0] ?? 14;

        return [desktopLayout.value ? size : size < 14 ? 8 : 20];
    },

    set(value: number[]): void {
        gridSize.value = value;
    },
});
const gridSizeReady = useMounted();
const selectedUuid = ref<string | null>(null);
const selectedGeneration = computed(function () {
    return props.generations.find(function (generation) { return generation.uuid === selectedUuid.value; }) ?? null;
});
let selectionTrigger: HTMLElement | null = null;

function selectGeneration(uuid: string): void {
    selectionTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedUuid.value = uuid;
}

function restoreSelectionFocus(event: Event): void {
    event.preventDefault();
    selectionTrigger?.focus();
}

const deleteGenerationDialog = useTemplateRef<InstanceType<typeof DeleteGenerationDialog>>("deleteGenerationDialog");
const promptSidebar = useTemplateRef<InstanceType<typeof PromptSidebar>>("promptSidebar");

function retrySelectedGeneration(generation: Generation): void {
    if (!promptSidebar.value || promptSidebar.value.busy) {
        return;
    }

    selectedUuid.value = null;
    mobileView.value = "create";
    void promptSidebar.value.retryGeneration(generation);
}

usePoll(5000, {
    only: ["generations", "balance"],
});
</script>

<template>
    <Head title="Generations" />

    <Tabs as-child v-model="mobileView">
        <Page class="flex-col gap-0">
            <div class="shrink-0 border-b border-border p-4 lg:hidden">
                <TabsList class="w-full" aria-label="Generation views">
                    <TabsTrigger value="create">Create</TabsTrigger>
                    <TabsTrigger value="library">Library</TabsTrigger>
                </TabsList>
            </div>

            <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <TabsContent class="hidden min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden data-[state=active]:flex lg:flex lg:flex-none lg:border-r lg:border-border" value="create" force-mount>
                    <PageAside class="min-w-0 flex-1 overflow-hidden">
                        <PromptSidebar ref="promptSidebar" />
                    </PageAside>
                </TabsContent>

                <TabsContent class="hidden min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden data-[state=active]:flex lg:flex" value="library" force-mount>
                    <PageMain>
                        <PageSection>
                            <PageSectionHeading class="shrink-0 flex-nowrap border-b border-border">
                                <PageSectionHeadingTitle as="h1" class="font-medium tracking-wide">
                                    <LibraryBig class="size-4 shrink-0" aria-hidden="true" />
                                    <span>Library</span>
                                </PageSectionHeadingTitle>

                                <PageSectionHeadingActions class="flex shrink-0 gap-4">
                                    <span class="text-sm whitespace-nowrap text-foreground-muted">{{ props.generations.length }} images</span>

                                    <!-- Item size -->
                                    <Tooltip>
                                        <TooltipTrigger as-child>
                                            <Slider size="sm" class="w-20" :class="{ invisible: !gridSizeReady }" v-model="displayedGridSize" :thumb-attrs="{ 'aria-label': 'Grid item size' }" :min="8" :max="20" :step="desktopLayout ? 1 : 12" />
                                        </TooltipTrigger>

                                        <TooltipContent>Item size</TooltipContent>
                                    </Tooltip>
                                </PageSectionHeadingActions>
                            </PageSectionHeading>

                            <PageSectionContent>
                                <LibraryItems v-if="props.generations.length" v-show="gridSizeReady" :item-size="displayedGridSize[0]" :generations="props.generations" :selected-uuid="selectedUuid" :processing-delete="deleteGenerationDialog?.processing ?? false" :processing-retry="promptSidebar?.busy ?? true" @select="selectGeneration" @retry="retrySelectedGeneration" @delete="deleteGenerationDialog?.show($event)" />
                                <EmptyLibrary v-else />
                            </PageSectionContent>
                        </PageSection>
                    </PageMain>
                </TabsContent>
            </div>

            <DeleteGenerationDialog ref="deleteGenerationDialog" />
            <GenerationDetailsDialog :generation="selectedGeneration" :processing-delete="deleteGenerationDialog?.processing ?? false" :processing-retry="promptSidebar?.busy ?? true" @close="selectedUuid = null" @retry="retrySelectedGeneration" @close-auto-focus="restoreSelectionFocus" @delete="deleteGenerationDialog?.show($event)" />
        </Page>
    </Tabs>
</template>

<style></style>
