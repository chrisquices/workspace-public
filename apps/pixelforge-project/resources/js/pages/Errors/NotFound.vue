<script setup lang="ts">
import ErrorPage from "@/components/ErrorPage.vue";

const props = defineProps<{
    status: number
}>();
</script>

<template>
    <ErrorPage heading="We couldn’t find that page." description="The link may have changed, or the page may have moved." :status="props.status" title="Page not found" />
</template>

<style></style>
