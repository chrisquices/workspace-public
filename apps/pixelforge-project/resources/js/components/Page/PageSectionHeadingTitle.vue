<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { Primitive } from "reka-ui";
import { cn } from "workspace-packages/ui/utils";

const props = withDefaults(defineProps<PrimitiveProps & {
    class?: HTMLAttributes["class"]
}>(), {
    as: "h2",
});

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
    <Primitive
        data-slot="page-section-heading-title"
        v-bind="delegatedProps"
        :class="cn('flex min-w-0 items-center gap-2', props.class)">
        <slot />
    </Primitive>
</template>
<style></style>
