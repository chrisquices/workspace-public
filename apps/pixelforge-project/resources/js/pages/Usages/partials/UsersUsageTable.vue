<script setup lang="ts">
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "workspace-packages/ui/table";
import type { SortDirection } from "workspace-packages/utilities/sort";
import type { UserUsage, UserUsageSortColumn } from "@/types/usage";

const props = defineProps<{
    usages: UserUsage[]
    sortBy: UserUsageSortColumn
    sortDirection: SortDirection
}>();

const emit = defineEmits<{
    sort: [column: UserUsageSortColumn]
}>();
</script>

<template>

    <!-- Daily usage by user -->
    <Table>
        <TableHeader>
            <TableRow>

                <!-- Date -->
                <TableHead sortable :sorted="props.sortBy === 'date'" :sort-direction="props.sortDirection" tabindex="0" @click.exact="emit('sort', 'date')" @keydown.enter.prevent="emit('sort', 'date')" @keydown.space.prevent="emit('sort', 'date')">
                    Date
                </TableHead>

                <!-- User -->
                <TableHead sortable :sorted="props.sortBy === 'userName'" :sort-direction="props.sortDirection" tabindex="0" @click.exact="emit('sort', 'userName')" @keydown.enter.prevent="emit('sort', 'userName')" @keydown.space.prevent="emit('sort', 'userName')">
                    User
                </TableHead>

                <!-- Credit Spend -->
                <TableHead class="text-right" sortable :sorted="props.sortBy === 'creditSpend'" :sort-direction="props.sortDirection" tabindex="0" @click.exact="emit('sort', 'creditSpend')" @keydown.enter.prevent="emit('sort', 'creditSpend')" @keydown.space.prevent="emit('sort', 'creditSpend')">
                    Credit Spend
                </TableHead>

                <!-- Provider Cost -->
                <TableHead class="text-right" sortable :sorted="props.sortBy === 'providerCost'" :sort-direction="props.sortDirection" tabindex="0" @click.exact="emit('sort', 'providerCost')" @keydown.enter.prevent="emit('sort', 'providerCost')" @keydown.space.prevent="emit('sort', 'providerCost')">
                    Provider Cost
                </TableHead>

                <!-- Profit -->
                <TableHead class="text-right" sortable :sorted="props.sortBy === 'profit'" :sort-direction="props.sortDirection" tabindex="0" @click.exact="emit('sort', 'profit')" @keydown.enter.prevent="emit('sort', 'profit')" @keydown.space.prevent="emit('sort', 'profit')">
                    Profit
                </TableHead>
            </TableRow>
        </TableHeader>

        <TableBody>

            <!-- User daily usage -->
            <TableRow v-for="usage in props.usages" :key="`${usage.date}-${usage.userId}`">

                <!-- Date -->
                <TableCell>
                    {{ usage.dateFormatted }}
                </TableCell>

                <!-- User -->
                <TableCell>
                    {{ usage.userName }}
                </TableCell>

                <!-- Credit Spend -->
                <TableCell class="text-right tabular-nums">
                    {{ usage.creditSpendFormatted }}
                </TableCell>

                <!-- Provider Cost -->
                <TableCell class="text-right tabular-nums">
                    {{ usage.providerCostFormatted }}
                </TableCell>

                <!-- Profit -->
                <TableCell class="text-right tabular-nums">
                    {{ usage.profitFormatted }}
                </TableCell>
            </TableRow>

            <!-- No usage -->
            <TableEmpty v-if="!props.usages.length" :colspan="5">No usage found.</TableEmpty>
        </TableBody>
    </Table>
</template>

<style></style>
