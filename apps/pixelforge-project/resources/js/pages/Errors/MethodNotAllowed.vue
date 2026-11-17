<script setup lang="ts">
import ErrorPage from "@/components/ErrorPage.vue";

const props = defineProps<{
    status: number
}>();
</script>

<template>
    <ErrorPage heading="This action isn’t supported here." description="The requested method isn’t allowed for this address." :status="props.status" title="Method not allowed" />
</template>

<style></style>
