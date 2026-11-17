<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "workspace-packages/ui/card";

const props = defineProps<{
    creditSpend: string
    providerCost: string
    profit: string
}>();
</script>

<template>
    <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3" aria-label="Usage totals">

        <!-- Credit Spend -->
        <Card class="bg-surface-muted shadow-none!">
            <CardHeader>
                <CardTitle>Credit Spend</CardTitle>
            </CardHeader>

            <CardContent>
                <p class="text-2xl font-semibold tabular-nums">{{ props.creditSpend }}</p>
            </CardContent>
        </Card>

        <!-- Provider Cost -->
        <Card class="bg-surface-muted shadow-none!">
            <CardHeader>
                <CardTitle>Provider Cost</CardTitle>
            </CardHeader>

            <CardContent>
                <p class="text-2xl font-semibold tabular-nums">{{ props.providerCost }}</p>
            </CardContent>
        </Card>

        <!-- Profit -->
        <Card class="bg-surface-muted shadow-none!">
            <CardHeader>
                <CardTitle>Profit</CardTitle>
            </CardHeader>

            <CardContent>
                <p class="text-2xl font-semibold tabular-nums">{{ props.profit }}</p>
            </CardContent>
        </Card>
    </div>
</template>

<style></style>
