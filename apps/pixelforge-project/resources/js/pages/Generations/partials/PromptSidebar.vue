<script setup lang="ts">
import { router, useHttp, usePage } from "@inertiajs/vue3";
import { Image, Plus, Sparkles } from "@lucide/vue";
import { computed, reactive, ref, useTemplateRef, watch } from "vue";
import { useDropzone } from "workspace-packages/ui-engines/dropzone/vue";
import { AspectRatio } from "workspace-packages/ui/aspect-ratio";
import { Button } from "workspace-packages/ui/button";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "workspace-packages/ui/field";
import { Grid, GridItem, GridItemAction, GridItemActionRemove, GridItemContent } from "workspace-packages/ui/grid";
import { Slider } from "workspace-packages/ui/slider";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "workspace-packages/ui/sidebar";
import { Spinner } from "workspace-packages/ui/spinner";
import { Textarea } from "workspace-packages/ui/textarea";
import { estimate, store } from "@/actions/App/Http/Controllers/GenerationController";
import InsufficientCreditsAlertDialog from "@/pages/Generations/partials/InsufficientCreditsAlertDialog.vue";
import type { Generation, GenerationEstimate, GenerationEstimateInput } from "@/types/generation";

const page = usePage();
const prompt = ref("");
const size = ref("1024x1024");
const sizes = [
    {
        value: "1024x1024",
        label: "1024×1024",
        previewClass: "w-7",
        ratio: 1,
    },
    {
        value: "1536x1024",
        label: "1536×1024",
        previewClass: "w-7.5",
        ratio: 3 / 2,
    },
    {
        value: "1024x1536",
        label: "1024×1536",
        previewClass: "w-5",
        ratio: 2 / 3,
    },
];

function selectSize(value: string): void {
    size.value = value;
}

const qualityLevels = ["Low", "Medium", "High"];
const qualityStep = ref([1]);
const qualityLabel = computed(function () {
    return qualityLevels[qualityStep.value[0] ?? 1];
});
const promptLength = computed(function () {
    return Array.from(prompt.value).length;
});
const restoringGeneration = ref(false);
const insufficientCreditsAlertDialog = useTemplateRef<InstanceType<typeof InsufficientCreditsAlertDialog>>("insufficientCreditsAlertDialog");
const newGeneration = reactive({
    request: useHttp({
        submissionKey: "",
        prompt: "",
        size: "1024x1024",
        quality: "medium",
        referenceImages: [] as File[],
    }),

    async handleSubmit(): Promise<void> {
        if (this.request.processing) return;

        if (restoringGeneration.value || priceEstimate.status === "loading") {
            return;
        }

        this.request.clearErrors();

        if (!prompt.value.trim() || promptLength.value > 4000) {
            this.request.setError("prompt", "Enter a prompt of up to 4,000 characters.");

            return;
        }

        if (referenceState.value?.collecting) {
            this.request.setError("referenceImages", "Please wait for your reference images to finish loading.");

            return;
        }

        const files = (referenceState.value?.files ?? []).map(function (reference) {
            return reference.file;
        });
        const quality = qualityLabel.value?.toLowerCase() ?? "medium";
        const changed = this.request.prompt !== prompt.value.trim() || this.request.size !== size.value || this.request.quality !== quality
            || this.request.referenceImages.length !== files.length || files.some((file, index) => file !== this.request.referenceImages[index]);

        if (!this.request.submissionKey || changed) {
            this.request.submissionKey = crypto.randomUUID();
        }

        this.request.prompt = prompt.value.trim();
        this.request.size = size.value;
        this.request.quality = quality;
        this.request.referenceImages = files;

        await this.submit();
    },

    async submit(): Promise<void> {
        try {
            await this.request.post(store.url(), {
                onSuccess: function () {
                    newGeneration.request.submissionKey = "";

                    router.reload({
                        only: ["generations", "balance"],
                    });
                },

                onError: function (errors) {
                    if (!("credits" in errors) || !insufficientCreditsAlertDialog.value) {
                        return;
                    }

                    newGeneration.request.clearErrors();
                    insufficientCreditsAlertDialog.value.show();
                },
            });
        } catch {
            this.request.setError("submissionKey", "We couldn’t submit your request. Please try again.");
        }
    },
});

const busy = computed(function () {
    return newGeneration.request.processing || restoringGeneration.value;
});
const submissionErrors = computed(function () {
    return Object
        .values(newGeneration.request.errors)
        .flat();
});
const referenceDropzone = useTemplateRef<HTMLElement>("referenceDropzone");
const {
    engine: referenceEngine,
    state: referenceState,
    error: referenceError,
    openFilePicker,
} = useDropzone({
    element: referenceDropzone,
    config: computed(function () {
        return {
            enabled: !busy.value,
            files: {
                accept: page.props.config.supportedFileFormats.image.map(function (extension) { return `.${extension}`; }),
                limits: {
                    maxFiles: Math.min(4, page.props.config.upload.maxFiles),
                    maxSize: page.props.config.upload.maxSize,
                },
                multiple: {
                    enabled: true,
                },
            },
            picker: {
                openOnClick: {
                    enabled: false,
                },
            },
            thumbnails: {
                image: {
                    enabled: true,
                },
            },
        };
    }),
});

function removeReferenceImage(file: File): void {
    referenceEngine.value?.removeFile(file);
}

async function retryGeneration(generation: Generation): Promise<void> {
    if (busy.value || referenceState.value?.collecting || !referenceEngine.value) {
        return;
    }

    restoringGeneration.value = true;

    newGeneration.request.clearErrors();

    try {
        const files = await Promise.all(generation.referenceImages.map(async function (url) {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error("Reference image unavailable.");
            }

            const blob = await response.blob();
            const name = new URL(url, window.location.href).pathname
                .split("/")
                .pop() || "reference";

            return new File([blob], name, {
                type: blob.type,
            });
        }));
        const engine = referenceEngine.value;

        if (!engine) return;

        const previousFiles = engine
            .getState().files
            .map(function (reference) { return reference.file; });

        engine.clearFiles();

        const result = engine.addFiles(files);

        if (result.errors.length) {
            engine.addFiles(previousFiles);

            throw new Error("Reference images could not be restored.");
        }

        prompt.value = generation.prompt;
        size.value = generation.size;
        qualityStep.value = [qualityLevels.findIndex(function (quality) { return quality.toLowerCase() === generation.quality; })];
        newGeneration.request.submissionKey = "";
    } catch {
        newGeneration.request.setError("referenceImages", "Couldn’t restore this generation’s reference images. Your current inputs have been kept.");
    } finally {
        restoringGeneration.value = false;
    }
}

defineExpose({
    retryGeneration: retryGeneration,
    busy: busy,
});

const priceEstimate = reactive({
    request: useHttp<GenerationEstimateInput, { estimate: GenerationEstimate }>({
        prompt: "",
        size: "1024x1024",
        quality: "medium",
        referenceImageCount: 0,
    }),

    result: null as GenerationEstimate | null,
    status: "idle" as "idle" | "loading" | "ready" | "error",

    async update(input: GenerationEstimateInput, isCurrent: () => boolean): Promise<void> {
        Object.assign(this.request, input);

        try {
            const response = await this.request.post(estimate.url());

            if (!isCurrent()) return;

            if (!response?.estimate) {
                this.status = "error";
                return;
            }

            this.result = response.estimate;
            this.status = "ready";
        } catch {
            if (isCurrent()) this.status = "error";
        }
    },
});

const buttonLoading = computed(function () {
    return busy.value || priceEstimate.status === "loading";
});
const estimateInput = computed<GenerationEstimateInput>(function () {
    return {
        prompt: prompt.value,
        size: size.value,
        quality: qualityLabel.value?.toLowerCase() ?? "medium",
        referenceImageCount: referenceState.value?.count ?? 0,
    };
});
const estimateValue = computed(function () {
    if (priceEstimate.status === "error") {
        return "Unavailable";
    }

    if (priceEstimate.result) {
        return `~${priceEstimate.result.maxPriceUsdFormatted}`;
    }

    return "—";
});

watch(
    estimateInput,
    function (input, _previousInput, onCleanup) {
        priceEstimate.result = null;
        priceEstimate.status = "idle";

        if (!input.prompt.trim() || Array.from(input.prompt).length > 4000) {
            return;
        }

        priceEstimate.status = "loading";
        let current = true;
        const timer = setTimeout(
            function () {
                void priceEstimate.update(
                    input,
                    function () {
                        return current;
                    },
                );
            },
            400,
        );

        onCleanup(function () {
            current = false;

            clearTimeout(timer);
            priceEstimate.request.cancel();
        });
    },
);
</script>

<template>

    <!-- Prompt sidebar -->
    <Sidebar size="default" side="left" class="min-h-0 w-full lg:w-sidebar-width" collapsible="none">
        <SidebarHeader class="border-b border-border">
            <h2 class="flex items-center gap-2 font-medium">
                <Sparkles aria-hidden="true" />
                <span>Image Generation</span>
            </h2>
        </SidebarHeader>

        <SidebarContent class="gap-6 p-4">

            <!-- Pixelforge -->
            <Button type="button" variant="outline" size="lg" class="grid! h-auto! w-full grid-cols-[auto_1fr] gap-x-3 gap-y-0 p-4! border border-border bg-input text-left">
                <span class="col-start-2 row-start-1 text-sm">Pixelforge</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="col-start-1 row-span-2 row-start-1 size-9 fill-current" aria-hidden="true">
                    <rect width="9" height="9" x="2" y="2" rx="1.5" />
                    <rect width="9" height="9" x="13" y="2" rx="1.5" opacity="0.6" />
                    <rect width="9" height="9" x="2" y="13" rx="1.5" opacity="0.6" />
                    <rect width="9" height="9" x="13" y="13" rx="1.5" opacity="0.3" />
                </svg>
                <span class="col-start-2 row-start-2 whitespace-normal text-2xs font-normal text-foreground-muted">Image Generation Simulator</span>
            </Button>

            <FieldGroup>

                <!-- Reference Images -->
                <Field orientation="vertical" :data-invalid="Boolean(referenceError)" aria-labelledby="generation-reference-label" :aria-describedby="referenceError ? 'generation-reference-error' : undefined">
                    <FieldLabel id="generation-reference-label" for="generation-reference-add" class="text-foreground-muted uppercase flex justify-between text-xs tracking-widest">
                        <span>Reference Images</span>
                        <span class="tabular-nums">{{ referenceState?.count ?? 0 }} / 4</span>
                    </FieldLabel>

                    <FieldContent>
                        <div ref="referenceDropzone">
                            <Grid
                                gap="sm"
                                :class="{ 'rounded-lg ring-2 ring-accent': referenceState?.draggingOver }"
                                style="grid-template-columns: repeat(5, minmax(0, 1fr))">
                                <GridItem
                                    id="generation-reference-add"
                                    class="flex aspect-square items-center justify-center bg-input border border-border"
                                    interactive
                                    :disabled="busy || !referenceEngine || (referenceState?.count ?? 0) >= 4 || referenceState?.collecting"
                                    title="Add reference images"
                                    aria-label="Add reference images"
                                    @click.stop="openFilePicker">
                                    <Plus class="size-5" aria-hidden="true" />
                                </GridItem>

                                <GridItem
                                    v-for="(reference, index) in referenceState?.files ?? []"
                                    :key="index"
                                    :title="reference.file.name">
                                    <GridItemContent>
                                        <img v-if="reference.thumbnail" :src="reference.thumbnail" :alt="reference.file.name" class="size-full object-cover">
                                        <div v-else class="flex size-full items-center justify-center" role="status" aria-label="Loading image preview">
                                            <Image class="size-5 text-foreground-muted" />
                                        </div>
                                    </GridItemContent>

                                    <GridItemAction class="top-0.5 right-0.5">
                                        <GridItemActionRemove :disabled="busy" :aria-label="`Remove ${reference.file.name}`" @click.stop="removeReferenceImage(reference.file)" />
                                    </GridItemAction>
                                </GridItem>
                            </Grid>
                        </div>

                        <FieldError v-if="referenceError" id="generation-reference-error" :errors="[referenceError.message]" />
                    </FieldContent>
                </Field>

                <!-- Prompt -->
                <Field orientation="vertical" :data-invalid="promptLength > 4000">
                    <FieldLabel for="generation-prompt" class="text-foreground-muted uppercase flex justify-between text-xs tracking-widest">
                        <span>Prompt</span>
                        <span id="generation-prompt-count" class="tabular-nums">{{ promptLength.toLocaleString() }} / 4,000</span>
                    </FieldLabel>

                    <FieldContent>
                        <Textarea id="generation-prompt" name="prompt" class="min-h-36 max-h-72 resize-y" v-model="prompt" placeholder="Describe the image you want to create…" required :disabled="busy" :aria-describedby="promptLength > 4000 ? 'generation-prompt-count generation-prompt-error' : 'generation-prompt-count'"
                                  :aria-invalid="promptLength > 4000" />

                        <FieldError v-if="promptLength > 4000" id="generation-prompt-error" :errors="['Use no more than 4,000 characters.']" />
                    </FieldContent>
                </Field>

                <!-- Size / Aspect Ratio -->
                <Field orientation="vertical" :data-invalid="false" aria-labelledby="generation-size-label">
                    <FieldLabel id="generation-size-label" :for="`generation-size-${size}`" class="text-foreground-muted uppercase flex justify-between text-xs tracking-widest">
                        <span>Size / Aspect Ratio</span>
                    </FieldLabel>

                    <FieldContent>
                        <div class="grid w-full grid-cols-3 gap-2">

                            <!-- Image size -->
                            <Button v-for="option in sizes" :key="option.value" :id="`generation-size-${option.value}`" type="button" :variant="size === option.value ? 'accent' : 'outline'" size="default" class="h-18! w-full min-w-0 flex-col gap-1" :disabled="busy" :title="option.value" :aria-pressed="size === option.value" @click.stop="selectSize(option.value)">
                                <span class="sr-only" aria-hidden="true">Image size</span>
                                <div class="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
                                    <div :class="option.previewClass">
                                        <AspectRatio :ratio="option.ratio" class="rounded-[4px] border border-border bg-accent/30" />
                                    </div>
                                </div>
                                <span class="text-xs tabular-nums">{{ option.label }}</span>
                            </Button>
                        </div>
                    </FieldContent>
                </Field>

                <!-- Quality -->
                <Field orientation="vertical" :data-invalid="false" aria-labelledby="generation-quality-label">
                    <FieldLabel id="generation-quality-label" for="generation-quality" class="text-foreground-muted uppercase flex justify-between text-xs tracking-widest">
                        <span>Quality</span>
                    </FieldLabel>

                    <FieldContent>
                        <Slider class="h-6" v-model="qualityStep" :thumb-attrs="{ id: 'generation-quality', 'aria-labelledby': 'generation-quality-label', 'aria-describedby': 'generation-quality-help', 'aria-valuetext': qualityLabel }" :min="0" :max="2" :step="1" :disabled="busy" />

                        <div class="flex justify-between text-xs text-foreground-muted" aria-hidden="true">
                            <span v-for="(label, index) in qualityLevels" :key="label" :class="{ 'font-medium text-foreground': qualityStep[0] === index }">{{ label }}</span>
                        </div>

                        <div id="generation-quality-help" class="sr-only">Choose Low, Medium, or High. Use arrow keys to adjust.</div>
                    </FieldContent>
                </Field>
            </FieldGroup>
        </SidebarContent>

        <SidebarFooter class="mt-auto w-full shrink-0 flex-col items-stretch gap-3 border-t border-border">

            <!-- Submission errors -->
            <Field v-if="newGeneration.request.hasErrors" orientation="vertical" :data-invalid="true">
                <FieldContent>
                    <FieldError id="generation-submit-errors" :errors="submissionErrors" />
                </FieldContent>
            </Field>

            <!-- Generate -->
            <Button type="button" variant="primary" size="lg" class="w-full" :disabled="buttonLoading || !prompt.trim() || promptLength > 4000 || referenceState?.collecting" :aria-label="buttonLoading ? 'Loading generation' : undefined" :aria-describedby="newGeneration.request.hasErrors ? 'generation-submit-errors' : undefined" :aria-disabled="buttonLoading" :aria-busy="buttonLoading" @click="newGeneration.handleSubmit()">
                <Spinner v-if="buttonLoading" aria-hidden="true" />
                <Sparkles v-else aria-hidden="true" />
                <span class="sr-only" aria-hidden="true">Generate</span>
                <span v-if="!buttonLoading">Generate</span>
                <span v-if="!buttonLoading" class="tabular-nums" role="status">
                    <span class="sr-only">Estimated price: </span>
                    {{ estimateValue }}
                </span>
            </Button>
        </SidebarFooter>

        <InsufficientCreditsAlertDialog ref="insufficientCreditsAlertDialog" />
    </Sidebar>
</template>

<style></style>
