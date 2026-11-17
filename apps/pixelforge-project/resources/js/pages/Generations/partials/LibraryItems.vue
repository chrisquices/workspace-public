<script setup lang="ts">
import { RotateCcw, Trash2 } from "@lucide/vue";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuLabelContainer, ContextMenuTrigger } from "workspace-packages/ui/context-menu";
import { Grid, GridItem, GridItemContent, GridItemLabel } from "workspace-packages/ui/grid";
import ItemThumbnail from "@/pages/Generations/partials/ItemThumbnail.vue";
import type { Generation } from "@/types/generation";

const props = defineProps<{
    generations: Generation[]
    itemSize: number
    selectedUuid: string | null
    processingDelete: boolean
    processingRetry: boolean
}>();

const emit = defineEmits<{
    select: [uuid: string]
    retry: [generation: Generation]
    delete: [generation: Pick<Generation, "uuid" | "prompt" | "status">]
}>();
</script>

<template>
    <Grid
        as="ul"
        :item-size="`${props.itemSize}rem`"
        class="m-4 content-start">
        <li v-for="generation in props.generations" :key="generation.uuid" class="min-w-0">
            <ContextMenu>
                <ContextMenuTrigger as-child>
                    <GridItem class="w-full text-left" interactive :selected="props.selectedUuid === generation.uuid" :aria-label="generation.prompt" :aria-pressed="props.selectedUuid === generation.uuid" @click="emit('select', generation.uuid)">
                        <GridItemContent>
                            <ItemThumbnail :generation="generation" :show-status="false" />
                        </GridItemContent>

                        <GridItemLabel variant="overlay" class="flex flex-col items-start gap-2">
                            <span class="line-clamp-2 break-words">{{ generation.prompt }}</span>
                        </GridItemLabel>
                    </GridItem>
                </ContextMenuTrigger>

                <ContextMenuContent>

                    <!-- Labels -->
                    <ContextMenuLabelContainer>

                        <!-- Label -->
                        <ContextMenuLabel>
                            {{ generation.providerGenerationId ?? 'Failed generation' }}
                        </ContextMenuLabel>
                    </ContextMenuLabelContainer>

                    <!-- Retry -->
                    <ContextMenuItem :disabled="props.processingRetry" @select="emit('retry', generation)">
                        <RotateCcw aria-hidden="true" />
                        <span>Retry</span>
                    </ContextMenuItem>

                    <!-- Delete -->
                    <ContextMenuItem
                        v-if="generation.canBeDeleted"
                        variant="destructive"
                        :disabled="props.processingDelete"
                        @select="emit('delete', { uuid: generation.uuid, prompt: generation.prompt, status: generation.status })">
                        <Trash2 aria-hidden="true" />
                        <span>Delete</span>
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </li>
    </Grid>
</template>

<style></style>
