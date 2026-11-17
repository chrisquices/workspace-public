<script setup lang="ts">
import { Head, router } from "@inertiajs/vue3";
import { parseDate } from "@internationalized/date";
import type { DateRange } from "reka-ui";
import { computed, markRaw, reactive, ref } from "vue";
import { toastFirstValidationError } from "workspace-packages/inertia-helper";
import { index } from "@/actions/App/Http/Controllers/UsageController";
import { sort } from "workspace-packages/utilities/sort";
import type { SortDirection } from "workspace-packages/utilities/sort";
import { Page, PageMain, PageSection, PageSectionContent, PageSectionHeading, PageSectionHeadingTitle } from "@/components/Page";
import UsageSidebar from "@/pages/Usages/partials/UsageSidebar.vue";
import UsersUsageFilters from "@/pages/Usages/partials/UsersUsageFilters.vue";
import UsersUsageSummary from "@/pages/Usages/partials/UsersUsageSummary.vue";
import UsersUsageTable from "@/pages/Usages/partials/UsersUsageTable.vue";
import type { UsageUserOption, UserUsage, UserUsageSortColumn } from "@/types/usage";

const props = defineProps<{
    usages: UserUsage[]
    users: UsageUserOption[]
    filters: {
        startDate: string
        endDate: string
        userId: number | null
        sortBy: UserUsageSortColumn
        sortDirection: SortDirection
    }
}>();

const usageFilters = reactive({
    dateRange: markRaw<DateRange>({
        start: parseDate(props.filters.startDate),
        end: parseDate(props.filters.endDate),
    }),

    userId: (props.filters.userId ?? "all") as number | "all",

    selectDates(value: DateRange): void {
        this.dateRange = markRaw(value);

        this.apply();
    },

    selectUser(value: number | "all"): void {
        this.userId = value;

        this.apply();
    },

    reset(): void {
        this.dateRange = markRaw({
            start: parseDate(props.filters.startDate),
            end: parseDate(props.filters.endDate),
        });
        this.userId = props.filters.userId ?? "all";
    },

    apply(): void {
        if (!this.dateRange.start || !this.dateRange.end) {
            return;
        }

        router.get(index.url(), {
            startDate: this.dateRange.start.toString(),
            endDate: this.dateRange.end.toString(),
            userId: this.userId === "all" ? null : this.userId,
            sortBy: sortBy.value,
            sortDirection: sortDirection.value,
        }, {
            preserveScroll: true,
            preserveState: "errors",

            onError: function (errors) {
                usageFilters.reset();
                toastFirstValidationError(errors);
            },
        });
    },
});

const sortBy = ref<UserUsageSortColumn>(props.filters.sortBy);
const sortDirection = ref<SortDirection>(props.filters.sortDirection);
const sortedUsages = computed(function () {
    return sort(props.usages, {
        by: function (usage) {
            const value = usage[sortBy.value];

            return sortBy.value === "date" || sortBy.value === "userName" ? value : Number(value);
        },

        direction: sortDirection.value,
    });
});
const demoCurrencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
});
const summary = computed(function () {
    const totals = sortedUsages.value.reduce(
        function (total, usage) {
            return {
                creditSpend: total.creditSpend + Number(usage.creditSpend),
                providerCost: total.providerCost + Number(usage.providerCost),
                profit: total.profit + Number(usage.profit),
            };
        },
        {
            creditSpend: 0,
            providerCost: 0,
            profit: 0,
        },
    );

    return {
        creditSpend: demoCurrencyFormatter.format(totals.creditSpend),
        providerCost: demoCurrencyFormatter.format(totals.providerCost),
        profit: demoCurrencyFormatter.format(totals.profit),
    };
});

function sortUsages(column: UserUsageSortColumn): void {
    sortDirection.value = sortBy.value === column && sortDirection.value === "asc" ? "desc" : "asc";
    sortBy.value = column;
}
</script>

<template>
    <Page class="flex-col lg:flex-row">
        <Head title="Usage" />

        <UsageSidebar />

        <!-- Usage -->
        <PageMain>
            <PageSection>
                <PageSectionHeading class="h-auto min-h-header-height shrink-0 border-b border-border">
                    <PageSectionHeadingTitle as="h1" class="sr-only">Usage</PageSectionHeadingTitle>
                    <UsersUsageFilters
                        :date-range="usageFilters.dateRange"
                        :user-id="usageFilters.userId"
                        :users="props.users"
                        @update:date-range="usageFilters.selectDates($event)"
                        @update:user-id="usageFilters.selectUser($event)" />
                </PageSectionHeading>

                <PageSectionContent>
                    <UsersUsageSummary :credit-spend="summary.creditSpend" :provider-cost="summary.providerCost" :profit="summary.profit" />
                    <UsersUsageTable :usages="sortedUsages" :sort-by="sortBy" :sort-direction="sortDirection" @sort="sortUsages" />
                </PageSectionContent>
            </PageSection>
        </PageMain>
    </Page>
</template>

<style></style>
