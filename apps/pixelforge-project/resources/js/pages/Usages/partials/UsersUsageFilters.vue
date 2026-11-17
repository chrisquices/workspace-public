<script setup lang="ts">
import { CalendarDays, Check, ChevronDown, Users } from "@lucide/vue";
import { ComboboxTrigger, useDateFormatter } from "reka-ui";
import type { AcceptableValue, DateRange } from "reka-ui";
import { computed } from "vue";
import { Button } from "workspace-packages/ui/button";
import { Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator, ComboboxList, ComboboxViewport } from "workspace-packages/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "workspace-packages/ui/popover";
import { RangeCalendar } from "workspace-packages/ui/range-calendar";
import type { UsageUserOption } from "@/types/usage";

const props = defineProps<{
    dateRange: DateRange
    userId: number | "all"
    users: UsageUserOption[]
}>();

const emit = defineEmits<{
    "update:dateRange": [value: DateRange]
    "update:userId": [value: number | "all"]
}>();

const formatter = useDateFormatter("en");
const dateRangeLabel = computed(function () {
    if (!props.dateRange.start) return "Select dates";
    if (!props.dateRange.end) return "Select end date";

    return `${formatter.selectedDate(props.dateRange.start, false)} – ${formatter.selectedDate(props.dateRange.end, false)}`;
});
const userLabel = computed(function () {
    return props.users.find(function (user) {
        return user.id === props.userId;
    })?.name ?? "All Users";
});

function selectUser(value: AcceptableValue): void {
    if (typeof value === "number" || value === "all") {
        emit("update:userId", value);
    }
}
</script>

<template>
    <div class="flex min-w-0 flex-wrap items-center gap-1">

        <!-- Date range -->
        <Popover>
            <PopoverTrigger as-child>

                <!-- Date range -->
                <Button type="button" variant="ghost" size="sm" class="rounded-full" :aria-label="`Date range: ${dateRangeLabel}`">
                    <CalendarDays aria-hidden="true" />
                    <span class="sr-only" aria-hidden="true">Date range</span>
                    <span>{{ dateRangeLabel }}</span>
                    <ChevronDown aria-hidden="true" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" class="w-auto p-0">
                <RangeCalendar :model-value="props.dateRange" initial-focus @update:model-value="emit('update:dateRange', $event)" />
            </PopoverContent>
        </Popover>

        <!-- User -->
        <Combobox
            :model-value="props.userId"
            @update:model-value="selectUser">
            <ComboboxAnchor class="w-auto">
                <ComboboxTrigger as-child tabindex="0" :aria-label="`Filter by user: ${userLabel}`">

                    <!-- User -->
                    <Button type="button" variant="ghost" size="sm" class="rounded-full">
                        <Users aria-hidden="true" />
                        <span class="sr-only" aria-hidden="true">User</span>
                        <span>{{ userLabel }}</span>
                        <ChevronDown aria-hidden="true" />
                    </Button>
                </ComboboxTrigger>
            </ComboboxAnchor>

            <ComboboxList class="min-w-64">
                <ComboboxInput placeholder="Search users…" aria-label="Search users" />
                <ComboboxEmpty>No users found.</ComboboxEmpty>
                <ComboboxViewport>

                    <!-- All Users -->
                    <ComboboxItem value="all">
                        <span>All Users</span>
                        <ComboboxItemIndicator>
                            <Check aria-hidden="true" />
                        </ComboboxItemIndicator>
                    </ComboboxItem>

                    <!-- User -->
                    <ComboboxItem v-for="user in props.users" :key="user.id" :value="user.id">
                        <span>{{ user.name }}</span>
                        <ComboboxItemIndicator>
                            <Check aria-hidden="true" />
                        </ComboboxItemIndicator>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxList>
        </Combobox>
    </div>
</template>

<style></style>
