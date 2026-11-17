<script setup lang="ts">
import ErrorPage from "@/components/ErrorPage.vue";

const props = defineProps<{
    status: number
}>();
</script>

<template>
    <ErrorPage heading="Something went wrong on our side." description="We couldn’t load this page right now. Please try again in a moment." :status="props.status" title="Something went wrong" />
</template>

<style></style>
