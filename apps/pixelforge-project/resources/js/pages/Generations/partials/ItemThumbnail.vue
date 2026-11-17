<script setup lang="ts">
import { ImageOff } from "@lucide/vue";
import { ref } from "vue";
import { Badge } from "workspace-packages/ui/badge";
import { DotLoader } from "workspace-packages/ui/dot-loader";
import type { Generation } from "@/types/generation";

const props = withDefaults(defineProps<{
    generation: Generation
    fit?: "cover" | "contain"
    showStatus?: boolean
}>(), {
    fit: "cover",
    showStatus: true,
});

const failedUrl = ref<string | null>(null);
const statusVariants = {
    pending: "secondary",
    queued: "warning",
    processing: "info",
    succeeded: "success",
    failed: "destructive",
} as const;

function handleImageError(): void {
    failedUrl.value = props.generation.imageUrl;
}
</script>

<template>
    <div class="relative isolate flex size-full items-center justify-center overflow-hidden text-foreground-muted" :class="props.fit === 'cover' ? 'bg-surface-muted' : ''">
        <template v-if="props.generation.status === 'succeeded' && props.generation.imageUrl && !props.generation.imageExpired && failedUrl !== props.generation.imageUrl">
            <img
                :src="props.generation.imageUrl"
                :alt="props.generation.prompt"
                decoding="async"
                class="relative"
                :class="props.fit === 'contain' ? 'max-h-full max-w-full rounded-lg object-contain' : 'size-full origin-center scale-160 object-cover'"
                loading="lazy"
                @error="handleImageError">
        </template>

        <div v-else-if="props.generation.status === 'pending' || props.generation.status === 'queued' || props.generation.status === 'processing'" class="flex size-full items-center justify-center" role="status">
            <!-- Generation loading -->
            <DotLoader class="absolute inset-0" aria-hidden="true" />

            <span class="relative text-sm capitalize">{{ props.generation.status }}</span>
        </div>

        <div v-else class="flex flex-col items-center gap-3 p-4 text-center">
            <ImageOff class="size-8" aria-hidden="true" />
            <span class="line-clamp-3 max-w-full break-words text-sm">{{ props.generation.status === 'failed' ? (props.generation.errorMessage || 'Generation failed') : 'Image unavailable' }}</span>
        </div>

        <Badge v-if="props.showStatus" :variant="statusVariants[props.generation.status]" class="absolute top-4 right-4 z-10 capitalize" role="status">
            {{ props.generation.status }}
        </Badge>
    </div>
</template>

<style></style>
