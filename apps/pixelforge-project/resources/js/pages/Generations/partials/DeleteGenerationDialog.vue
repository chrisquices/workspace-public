<script setup lang="ts">
import { toRef } from "vue";
import { toastFirstValidationError, useInertiaHelperForm } from "workspace-packages/inertia-helper";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "workspace-packages/ui/alert-dialog";
import { Button } from "workspace-packages/ui/button";
import { deleteMethod } from "@/actions/App/Http/Controllers/GenerationController";

const deleteGenerationAlertDialog = useInertiaHelperForm({
    config: {
        openable: true,
        minimumLoading: true,
    },
    form: {
        uuid: "",
        prompt: "",
        status: "",

        handleSubmit(): void {
            if (this.processing) return;

            this.submit();
        },

        submit(): void {
            this.delete(deleteMethod.url(this.uuid), {
                only: ["generations"],
                showProgress: false,
                preserveScroll: true,
                preserveState: true,

                onSuccess: function () {
                    deleteGenerationAlertDialog.hide();
                },

                onError: function (errors) {
                    toastFirstValidationError(errors);
                },
            });
        },
    },
});

defineExpose({
    show: deleteGenerationAlertDialog.show,
    processing: toRef(deleteGenerationAlertDialog, "processing"),
});
</script>

<template>

    <!-- Delete Generation? -->
    <AlertDialog
        :open="deleteGenerationAlertDialog.isOpen"
        :dismissible="!deleteGenerationAlertDialog.processing"
        :processing="deleteGenerationAlertDialog.processing"
        @update:open="open => { if (!deleteGenerationAlertDialog.processing) {
            deleteGenerationAlertDialog.setOpen(open);
        } }">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Generation?</AlertDialogTitle>
                <AlertDialogDescription>
                    This permanently removes the generation from your library. This cannot be undone.
                    <span v-if="deleteGenerationAlertDialog.status !== 'succeeded' && deleteGenerationAlertDialog.status !== 'failed'">Deleting it won’t cancel a generation already running.</span>
                </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>

                <!-- Delete Generation -->
                <AlertDialogAction as-child variant="destructive" @click.prevent="deleteGenerationAlertDialog.handleSubmit()">
                    <Button type="button" variant="destructive" size="default" :loading="deleteGenerationAlertDialog.processing">
                        <span>Delete Generation</span>
                    </Button>
                </AlertDialogAction>

                <AlertDialogCancel type="button" variant="primary" :disabled="deleteGenerationAlertDialog.processing">
                    Cancel
                </AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>

<style></style>
