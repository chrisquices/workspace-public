<script setup lang="ts">
import { toastFirstValidationError, useInertiaHelperForm } from "workspace-packages/inertia-helper";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "workspace-packages/ui/alert-dialog";
import { Button } from "workspace-packages/ui/button";
import { store } from "@/actions/App/Http/Controllers/TransactionController";

const newCreditsAlertDialog = useInertiaHelperForm({
    config: {
        openable: true,
        minimumLoading: true,
    },
    form: {
        transactionKey: "",

        handleSubmit(): void {
            if (this.processing) return;

            this.clearErrors();

            if (!this.transactionKey) {
                this.transactionKey = crypto.randomUUID();

                this.defaults({
                    transactionKey: this.transactionKey,
                });
            }

            this.submit();
        },

        submit(): void {
            this.post(store.url(), {
                only: ["balance"],
                showProgress: false,
                preserveScroll: true,
                preserveState: true,

                onSuccess: function () {
                    newCreditsAlertDialog.defaults({
                        transactionKey: "",
                    });
                    newCreditsAlertDialog.hide();
                },

                onError: function (errors) {
                    toastFirstValidationError(errors);
                },
            });
        },
    },
});

defineExpose({
    show: newCreditsAlertDialog.show,
});
</script>

<template>

    <!-- Purchase Credits -->
    <AlertDialog
        :open="newCreditsAlertDialog.isOpen"
        :dismissible="!newCreditsAlertDialog.processing"
        :processing="newCreditsAlertDialog.processing"
        @update:open="open => { if (!newCreditsAlertDialog.processing) {
            newCreditsAlertDialog.setOpen(open);
        } }">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Purchase Credits</AlertDialogTitle>
                <AlertDialogDescription>Add $5 to your credit balance with a simulated purchase. No real payment is required.</AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>

                <!-- Buy Credits (5$) -->
                <AlertDialogAction as-child variant="accent" @click.prevent="newCreditsAlertDialog.handleSubmit">
                    <Button type="button" variant="accent" size="default" :loading="newCreditsAlertDialog.processing" :disabled="newCreditsAlertDialog.processing">
                        <span>Buy Credits (5$)</span>
                    </Button>
                </AlertDialogAction>

                <!-- Close -->
                <AlertDialogCancel type="button" variant="ghost" :disabled="newCreditsAlertDialog.processing">
                    Close
                </AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>

<style></style>
