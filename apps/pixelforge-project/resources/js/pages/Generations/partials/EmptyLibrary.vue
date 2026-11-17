<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "workspace-packages/ui/empty";
</script>

<template>

    <!-- No generations yet -->
    <Empty>
        <EmptyHeader>
            <EmptyMedia>
                <Sparkles class="size-10" aria-hidden="true" />
            </EmptyMedia>

            <EmptyTitle>No generations yet</EmptyTitle>
            <EmptyDescription>
                Have an idea?
                <br>
                Describe it in the prompt to create your first image.
            </EmptyDescription>
        </EmptyHeader>
    </Empty>
</template>

<style></style>
