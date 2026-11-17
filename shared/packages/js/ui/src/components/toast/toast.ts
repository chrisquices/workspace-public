import {createToaster} from 'workspace-packages/ui-engines/toast';
import type {ToastEngine, ToastState} from 'workspace-packages/ui-engines/toast';

let engine: ToastEngine | null = null;
let releaseHost: (() => void) | null = null;

function getEngine(): ToastEngine {
    engine ??= createToaster({element: null, config: {}});

    return engine;
}

export const toast = {
    error(message: string, options?: {durationMs?: number}) {
        return getEngine().createToast({title: message, variant: 'error', ...options});
    },
    success(message: string) {
        return getEngine().createToast({title: message, variant: 'success'});
    },
    info(message: string) {
        return getEngine().createToast({title: message, variant: 'info'});
    },
};

export function createToastHost(onChange: (state: ToastState) => void) {
    if (releaseHost) {
        throw new Error('A toast host is already mounted.');
    }

    const hostEngine = getEngine();
    const unsubscribe = hostEngine.subscribe(onChange);
    let active = true;

    function destroy() {
        if (!active) return;
        active = false;
        unsubscribe();
        hostEngine.destroy();

        if (engine === hostEngine) engine = null;
        if (releaseHost === destroy) releaseHost = null;
    }

    releaseHost = destroy;
    onChange(hostEngine.getState());

    return {dismiss: hostEngine.dismissToast, destroy: destroy};
}

const hot = (import.meta as ImportMeta & {hot?: {dispose(callback: () => void): void}}).hot;

if (hot) {
    hot.dispose(function () {
        releaseHost?.();
        engine?.destroy();
        engine = null;
    });
}
