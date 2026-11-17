import { createInertiaApp } from "@inertiajs/vue3";
import AppLayout from "@/layouts/AppLayout.vue";
import AuthLayout from "@/layouts/AuthLayout.vue";
import GuestLayout from "@/layouts/GuestLayout.vue";

const appName = import.meta.env.VITE_APP_NAME || "Pixel";

void createInertiaApp({
    title: function (title) {
        return title ? `${title} - ${appName}` : appName;
    },

    layout: function (name) {
        switch (true) {
            case name.startsWith("Auth/"):
                return AuthLayout;
            case name.startsWith("Errors/"):
                return GuestLayout;
            default:
                return AppLayout;
        }
    },

    withApp: function (app) {
        app.directive("focus", {
            mounted: function (el: HTMLElement, shouldFocus) {
                if (shouldFocus.value !== false) {
                    el.focus();
                }
            },
        });
    },

    progress: {
        color: "#4B5563",
    },
});
