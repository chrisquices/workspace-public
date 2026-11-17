<script setup lang="ts">
import ErrorPage from "@/components/ErrorPage.vue";

const props = defineProps<{
    status: number
}>();
</script>

<template>
    <ErrorPage heading="We couldn’t process that request." description="Please check your request and try again." :status="props.status" title="Bad request" />
</template>

<style></style>
