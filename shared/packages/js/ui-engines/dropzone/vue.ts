import {computed, nextTick, shallowReadonly, shallowRef, toValue, watch, watchPostEffect} from 'vue';
import type {MaybeRefOrGetter} from 'vue';
import {createDropzone} from 'workspace-packages/ui-engines/dropzone';
import type {DropzoneConfig, DropzoneEngine, DropzoneError, DropzoneState} from 'workspace-packages/ui-engines/dropzone';

export interface UseDropzoneOptions {
    element: MaybeRefOrGetter<HTMLElement | null | undefined>;
    config: MaybeRefOrGetter<DropzoneConfig>;
}

/** Bind file intake to a Vue-owned element without prescribing UI or upload behavior. */
export function useDropzone(options: UseDropzoneOptions) {
    const engine = shallowRef<DropzoneEngine | null>(null);
    const state = shallowRef<DropzoneState | null>(null);
    const error = shallowRef<DropzoneError | null>(null);
    const config = computed(function (): DropzoneConfig {
        const value = toValue(options.config);
        const files = value.files;
        const onError = value.events?.onError;

        return {
            enabled: value.enabled,
            files: files && {
                accept: files.accept?.slice(),
                exclude: files.exclude?.slice(),
                limits: files.limits && {
                    minSize: files.limits.minSize,
                    maxSize: files.limits.maxSize,
                    maxFiles: files.limits.maxFiles,
                    maxTotalSize: files.limits.maxTotalSize,
                },
                multiple: files.multiple && {enabled: files.multiple.enabled},
                dedupe: files.dedupe && {enabled: files.dedupe.enabled},
            },
            picker: value.picker && {
                openOnClick: value.picker.openOnClick && {enabled: value.picker.openOnClick.enabled},
            },
            previews: value.previews && {
                video: value.previews.video && {enabled: value.previews.video.enabled},
            },
            thumbnails: value.thumbnails && {
                image: value.thumbnails.image && {enabled: value.thumbnails.image.enabled},
                video: value.thumbnails.video && {enabled: value.thumbnails.video.enabled},
                audio: value.thumbnails.audio && {enabled: value.thumbnails.audio.enabled},
            },
            events: {
                onChange: value.events?.onChange,
                onError: function (failure) {
                    error.value = failure;
                    onError?.(failure);
                },
            },
        };
    });

    watchPostEffect(async function (onCleanup) {
        const root = toValue(options.element);
        if (!root) return;

        let active = true;
        let instance: DropzoneEngine | null = null;
        let unsubscribe: (() => void) | undefined;
        onCleanup(function () {
            active = false;
            unsubscribe?.();
            instance?.destroy();
            engine.value = null;
            state.value = null;
            error.value = null;
        });
        await nextTick();
        if (!active) return;

        instance = createDropzone({element: root, config: config.value});
        if (!active) {
            instance.destroy();
            return;
        }
        unsubscribe = instance.subscribe(function (value) {state.value = value;});
        engine.value = instance;
        state.value = instance.getState();
    });

    watch(function () {return engine.value ? config.value : null;}, function (value) {
        if (value && engine.value) Object.assign(engine.value.config, value);
    }, {flush: 'post'});

    function openFilePicker(): void {
        error.value = null;
        engine.value?.openFilePicker();
    }

    function openFolderPicker(): void {
        error.value = null;
        engine.value?.openFolderPicker();
    }

    return {
        engine: shallowReadonly(engine),
        state: shallowReadonly(state),
        error: shallowReadonly(error),
        openFilePicker: openFilePicker,
        openFolderPicker: openFolderPicker,
    };
}
