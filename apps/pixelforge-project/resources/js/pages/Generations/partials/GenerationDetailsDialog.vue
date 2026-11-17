<script setup lang="ts">
import { ImageOff, RotateCcw, Trash2, X } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "workspace-packages/ui/avatar";
import { Button } from "workspace-packages/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "workspace-packages/ui/dialog";
import { Field, FieldContent, FieldLabel } from "workspace-packages/ui/field";
import { FileMetadata } from "workspace-packages/ui/file-metadata";
import { Grid, GridItem, GridItemContent } from "workspace-packages/ui/grid";
import { Sidebar, SidebarContent } from "workspace-packages/ui/sidebar";
import { Textarea } from "workspace-packages/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "workspace-packages/ui/tooltip";
import { TruncateMiddle } from "workspace-packages/ui/truncate-middle";
import ItemThumbnail from "@/pages/Generations/partials/ItemThumbnail.vue";
import type { Generation } from "@/types/generation";

const props = defineProps<{
    generation: Generation | null
    processingRetry: boolean
    processingDelete: boolean
}>();

const emit = defineEmits<{
    close: []
    closeAutoFocus: [event: Event]
    retry: [generation: Generation]
    delete: [generation: Generation]
}>();

function handleOpenChange(open: boolean): void {
    if (!open) emit("close");
}
</script>

<template>

    <!-- Generation details Dialog -->
    <Dialog
        :open="props.generation !== null"
        :dismissible="true"
        :processing="false"
        @update:open="handleOpenChange">
        <DialogContent class="isolate flex h-[min(80dvh,52rem)] flex-col gap-0 overflow-hidden bg-surface-muted p-0 sm:max-w-6xl" :show-close-button="false" @close-auto-focus="emit('closeAutoFocus', $event)">
            <template v-if="props.generation">
                <img
                    v-if="props.generation.status === 'succeeded' && props.generation.imageUrl && !props.generation.imageExpired"
                    :src="props.generation.imageUrl"
                    alt=""
                    class="pointer-events-none absolute inset-0 z-0 size-full scale-130 object-cover blur-3xl"
                    aria-hidden="true">

                <DialogDescription class="sr-only">Generated image, prompt, and generation details.</DialogDescription>
                <div class="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
                    <div class="relative min-h-0 min-w-0 flex-1 md:h-full">
                        <ItemThumbnail fit="contain" :generation="props.generation" />
                    </div>

                    <Sidebar side="right" class="relative h-auto max-h-[60%] min-h-0 w-full min-w-0 rounded-xl border border-border shadow-xl md:max-h-none md:w-96 md:self-stretch" collapsible="none">
                        <div class="flex shrink-0 items-start gap-4 p-6 pr-14 pb-0">
                            <DialogTitle class="min-w-0 flex-1 text-left">
                                <TruncateMiddle>{{ props.generation.providerGenerationId ?? 'Failed generation' }}</TruncateMiddle>
                            </DialogTitle>

                            <DialogClose as-child>
                                <Button type="button" variant="ghost" size="icon" class="absolute top-3.5 right-3.5" aria-label="Close">
                                    <X aria-hidden="true" />
                                    <span class="sr-only">Close</span>
                                </Button>
                            </DialogClose>
                        </div>

                        <SidebarContent class="gap-6 p-6">

                            <!-- Reference Images -->
                            <Field orientation="vertical" :data-invalid="false" aria-labelledby="generation-details-references-label">
                                <FieldLabel id="generation-details-references-label" for="generation-details-references">Reference Images</FieldLabel>
                                <FieldContent>
                                    <div>
                                        <Grid
                                            id="generation-details-references"
                                            gap="sm"
                                            style="grid-template-columns: repeat(4, minmax(0, 1fr))">
                                            <GridItem
                                                v-for="slot in 4"
                                                :key="slot">
                                                <GridItemContent class="bg-input">

                                                    <!-- Reference image unavailable -->
                                                    <Avatar v-if="props.generation.referenceImages[slot - 1]" :key="props.generation.referenceImages[slot - 1]" class="size-full rounded-none bg-input">
                                                        <AvatarImage :src="props.generation.referenceImages[slot - 1]" :alt="`Reference image ${slot}`" />
                                                        <AvatarFallback class="bg-input">
                                                            <ImageOff class="size-5" aria-hidden="true" />
                                                            <span class="sr-only">Reference image unavailable</span>
                                                        </AvatarFallback>
                                                    </Avatar>

                                                    <span v-else class="flex size-full items-center justify-center p-1 text-center text-xs text-foreground-muted" title="No reference image was provided for this slot.">Not used</span>
                                                </GridItemContent>
                                            </GridItem>
                                        </Grid>
                                    </div>
                                </FieldContent>
                            </Field>

                            <!-- Prompt -->
                            <Field orientation="vertical" :data-invalid="false">
                                <FieldLabel for="generation-details-prompt">Prompt</FieldLabel>
                                <FieldContent>
                                    <Textarea id="generation-details-prompt" :rows="4" class="field-sizing-fixed min-h-0 resize-none disabled:cursor-default disabled:opacity-100 md:field-sizing-content md:min-h-32 md:max-h-64" :model-value="props.generation.prompt" disabled />
                                </FieldContent>
                            </Field>

                            <FileMetadata
                                class="overflow-x-auto [&_dl]:grid-cols-[minmax(0,1fr)_max-content] [&_dt]:whitespace-normal"
                                :metadata="{
                                    Dimensions: props.generation.metadata.dimensions,
                                    Quality: props.generation.metadata.quality,
                                    'Estimated Cost': props.generation.metadata.estimatedCost,
                                    'Actual Cost': props.generation.metadata.actualCost,
                                    Created: props.generation.metadata.created,
                                }" />
                        </SidebarContent>

                        <div class="grid shrink-0 grid-cols-2 gap-2 p-6 pt-0">

                            <!-- Retry -->
                            <Button type="button" variant="outline" size="default" :disabled="props.processingRetry" @click.exact="emit('retry', props.generation)">
                                <RotateCcw aria-hidden="true" />
                                <span>Retry</span>
                            </Button>

                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <span class="flex min-w-0" :tabindex="!props.generation.canBeDeleted ? 0 : undefined">
                                        <Button type="button" variant="destructive" size="default" class="w-full" :disabled="props.processingDelete || !props.generation.canBeDeleted" @click.exact="emit('delete', props.generation)">
                                            <Trash2 aria-hidden="true" />
                                            <span>Delete</span>
                                        </Button>
                                    </span>
                                </TooltipTrigger>

                                <TooltipContent v-if="!props.generation.canBeDeleted" side="top">Only local failures without a provider ID can be deleted.</TooltipContent>
                            </Tooltip>
                        </div>
                    </Sidebar>
                </div>
            </template>
        </DialogContent>
    </Dialog>
</template>

<style></style>
