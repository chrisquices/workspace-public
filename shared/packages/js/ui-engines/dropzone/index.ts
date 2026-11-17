import {createErrorReporter, createNotifier} from 'workspace-packages/ui-engines/shared/core';
import {isDSStore} from '#ui-engines/shared/files';
import type {DropzoneReactiveConfig} from 'workspace-packages/ui-engines/dropzone/types';
import {captureEngineConfig, createEngineConfig} from 'workspace-packages/ui-engines/shared/engine-config';
import type {ConfigUpdate} from 'workspace-packages/ui-engines/shared/types';
import type {DropzoneConfigFields, DropzoneState, DropzoneError, DropzoneAddResult, DropzoneOptions, DropzoneEngine} from 'workspace-packages/ui-engines/dropzone/types';

export type {DropzoneConfigSnapshot, DropzoneReactiveConfig, DropzoneFile, DropzoneState, DropzoneError, DropzoneAddResult, DropzoneConfig, DropzoneOptions, DropzoneEngine} from 'workspace-packages/ui-engines/dropzone/types';

export function createDropzone(options: DropzoneOptions): DropzoneEngine {

    // region ----- Configuration ------------------------------------------------------------------------------------------
    validateOptions();

    const {element: element, config: config} = options;
    const {
        files: {
            accept: accept,
            exclude: exclude,
            limits: {
                minSize: minSize,
                maxSize: maxSize,
                maxFiles: maxFiles,
                maxTotalSize: maxTotalSize,
            } = {},
            multiple: {
                enabled: multipleEnabled = true,
            } = {},
            dedupe: {
                enabled: dedupeEnabled = true,
            } = {},
        } = {},
        picker: {
            openOnClick: {
                enabled: openOnClickEnabled = true,
            } = {},
        } = {},
        enabled: disabled = true,
        previews: {
            video: {
                enabled: videoPreviewEnabled = false,
            } = {},
        } = {},
        thumbnails: {
            image: {
                enabled: imageThumbnailsEnabled = false,
            } = {},
            video: {
                enabled: videoThumbnailsEnabled = false,
            } = {},
            audio: {
                enabled: audioThumbnailsEnabled = false,
            } = {},
        } = {},
        events: {
            onChange: onChange,
            onError: onError,
        } = {},
    } = config;

    validateConfig();

    function validateOptions() {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new TypeError(`createDropzone: 'options' must be an object.`);
        }

        if (!options.element || typeof options.element.addEventListener !== "function") {
            throw new TypeError(`createDropzone: 'element' must be a DOM element.`);
        }

        if (!options.config || typeof options.config !== "object" || Array.isArray(options.config)) {
            throw new TypeError(`createDropzone: 'config' must be an options object.`);
        }

        options = {...options, config: captureEngineConfig(options.config, configurationLayout)};
    }

    function validateConfig(update?: ConfigUpdate<keyof DropzoneConfigFields>) {
        if (update) {
            if (destroyed) return false;
            const values = {...configValues, ...(update.values as Partial<DropzoneConfigFields>), [update.key]: update.value};

            if (values.accept !== undefined && !isValidExtensionList(values.accept)) {
                throw new TypeError(`files.accept must be a non-empty array of dotted extension strings without surrounding whitespace.`);
            }

            if (values.exclude !== undefined && !isValidExtensionList(values.exclude)) {
                throw new TypeError(`files.exclude must be a non-empty array of dotted extension strings without surrounding whitespace.`);
            }

            if (values.minSize !== undefined && (!Number.isFinite(values.minSize) || values.minSize <= 0)) {
                throw new TypeError(`files.limits.minSize must be a positive number of bytes.`);
            }

            if (values.maxSize !== undefined && (!Number.isFinite(values.maxSize) || values.maxSize <= 0)) {
                throw new TypeError(`files.limits.maxSize must be a positive number of bytes.`);
            }

            if (values.maxFiles !== undefined && (!Number.isInteger(values.maxFiles) || values.maxFiles <= 0)) {
                throw new TypeError(`files.limits.maxFiles must be a positive whole number.`);
            }

            if (values.maxTotalSize !== undefined && (!Number.isFinite(values.maxTotalSize) || values.maxTotalSize <= 0)) {
                throw new TypeError(`files.limits.maxTotalSize must be a positive number of bytes.`);
            }

            if (typeof values.multipleEnabled !== 'boolean') {
                throw new TypeError(`files.multiple.enabled must be a boolean.`);
            }

            if (typeof values.openOnClickEnabled !== 'boolean') {
                throw new TypeError(`picker.openOnClick.enabled must be a boolean.`);
            }

            if (typeof values.disabled !== 'boolean') {
                throw new TypeError(`enabled must be a boolean.`);
            }

            if (typeof values.dedupeEnabled !== 'boolean') {
                throw new TypeError(`files.dedupe.enabled must be a boolean.`);
            }

            if (typeof values.videoPreviewEnabled !== 'boolean') {
                throw new TypeError(`previews.video.enabled must be a boolean.`);
            }

            if (typeof values.imageThumbnailsEnabled !== 'boolean') {
                throw new TypeError(`thumbnails.image.enabled must be a boolean.`);
            }

            if (typeof values.videoThumbnailsEnabled !== 'boolean') {
                throw new TypeError(`thumbnails.video.enabled must be a boolean.`);
            }

            if (typeof values.audioThumbnailsEnabled !== 'boolean') {
                throw new TypeError(`thumbnails.audio.enabled must be a boolean.`);
            }

            if (values.onChange !== undefined && typeof values.onChange !== 'function') {
                throw new TypeError(`events.onChange must be a function when provided.`);
            }

            if (values.onError !== undefined && typeof values.onError !== 'function') {
                throw new TypeError(`events.onError must be a function when provided.`);
            }

            if (values.minSize !== undefined && values.maxSize !== undefined && values.minSize > values.maxSize) {
                throw new TypeError(`createDropzone: 'files.limits.minSize' cannot exceed 'files.limits.maxSize'.`);
            }

            return !destroyed;
        }

        if (accept !== undefined && !isValidExtensionList(accept)) {
            throw new TypeError(`files.accept must be a non-empty array of dotted extension strings without surrounding whitespace.`);
        }

        if (exclude !== undefined && !isValidExtensionList(exclude)) {
            throw new TypeError(`files.exclude must be a non-empty array of dotted extension strings without surrounding whitespace.`);
        }

        if (minSize !== undefined && (!Number.isFinite(minSize) || minSize <= 0)) {
            throw new TypeError(`files.limits.minSize must be a positive number of bytes.`);
        }

        if (maxSize !== undefined && (!Number.isFinite(maxSize) || maxSize <= 0)) {
            throw new TypeError(`files.limits.maxSize must be a positive number of bytes.`);
        }

        if (maxFiles !== undefined && (!Number.isInteger(maxFiles) || maxFiles <= 0)) {
            throw new TypeError(`files.limits.maxFiles must be a positive whole number.`);
        }

        if (maxTotalSize !== undefined && (!Number.isFinite(maxTotalSize) || maxTotalSize <= 0)) {
            throw new TypeError(`files.limits.maxTotalSize must be a positive number of bytes.`);
        }

        if (typeof multipleEnabled !== 'boolean') {
            throw new TypeError(`files.multiple.enabled must be a boolean.`);
        }

        if (typeof openOnClickEnabled !== 'boolean') {
            throw new TypeError(`picker.openOnClick.enabled must be a boolean.`);
        }

        if (typeof disabled !== 'boolean') {
            throw new TypeError(`enabled must be a boolean.`);
        }

        if (typeof dedupeEnabled !== 'boolean') {
            throw new TypeError(`files.dedupe.enabled must be a boolean.`);
        }

        if (typeof videoPreviewEnabled !== 'boolean') {
            throw new TypeError(`previews.video.enabled must be a boolean.`);
        }

        if (typeof imageThumbnailsEnabled !== 'boolean') {
            throw new TypeError(`thumbnails.image.enabled must be a boolean.`);
        }

        if (typeof videoThumbnailsEnabled !== 'boolean') {
            throw new TypeError(`thumbnails.video.enabled must be a boolean.`);
        }

        if (typeof audioThumbnailsEnabled !== 'boolean') {
            throw new TypeError(`thumbnails.audio.enabled must be a boolean.`);
        }

        if (onChange !== undefined && typeof onChange !== 'function') {
            throw new TypeError(`events.onChange must be a function when provided.`);
        }

        if (onError !== undefined && typeof onError !== 'function') {
            throw new TypeError(`events.onError must be a function when provided.`);
        }

        if (minSize !== undefined && maxSize !== undefined && minSize > maxSize) {
            throw new TypeError(`createDropzone: 'files.limits.minSize' cannot exceed 'files.limits.maxSize'.`);
        }
    }

    // endregion

    // region ----- Init ---------------------------------------------------------------------------------------------------
    const configValues: DropzoneConfigFields = {
        accept: accept?.slice(),
        exclude: exclude?.slice(),
        minSize: minSize,
        maxSize: maxSize,
        maxFiles: maxFiles,
        maxTotalSize: maxTotalSize,
        multipleEnabled: multipleEnabled,
        openOnClickEnabled: openOnClickEnabled,
        disabled: !disabled,
        dedupeEnabled: dedupeEnabled,
        videoPreviewEnabled: videoPreviewEnabled,
        imageThumbnailsEnabled: imageThumbnailsEnabled,
        videoThumbnailsEnabled: videoThumbnailsEnabled,
        audioThumbnailsEnabled: audioThumbnailsEnabled,
        onChange: onChange,
        onError: onError,
    };
    let destroyed = false; // once torn down, a late-resolving async walk must not still fire callbacks
    const relativeFilePaths = new WeakMap<File, string>();

    function getRelativeFilePath(file: File): string {
        return relativeFilePaths.get(file) ?? file.webkitRelativePath ?? '';
    }

    function getFolderPath(file: File): string[] {
        return getRelativeFilePath(file).split('/').slice(0, -1);
    }

    function init() {
        removeOnChange = configValues.onChange ? subscribe(configValues.onChange) : null;

        registerAllEventListeners();
    }

    // endregion

    // region ----- Event Listeners ----------------------------------------------------------------------------------------
    const cleanups: (() => void)[] = []; // teardown functions, collected so everything can be undone at once

    // Register an event listener and remember how to remove it during teardown.
    function registerEventListener<K extends keyof HTMLElementEventMap>(target: EventTarget, type: K, handler: (event: HTMLElementEventMap[K]) => void) {
        function handleEvent(event: HTMLElementEventMap[K]) {
            if (destroyed) return;
            handler(event);
        }

        function removeListener() {
            target.removeEventListener(type, handleEvent as EventListener);
        }

        target.addEventListener(type, handleEvent as EventListener);

        cleanups.push(removeListener);

        return function removeRegisteredEventListener() {
            const index = cleanups.indexOf(removeListener);
            if (index === -1) return;

            cleanups.splice(index, 1);
            removeListener();
        };
    }

    function registerAllEventListeners() {

        // Drag & Drop
        registerEventListener(element, "dragenter", function (event) {
            if (configValues.disabled || collecting) return;

            if (!hasFiles(event.dataTransfer)) return; // leave non-file drags untouched

            event.preventDefault();
            dragDepth++; // count this entry (children fire their own dragenter events too)
            setDraggingOver(true);
        });
        registerEventListener(element, "dragover", function (event: DragEvent) {
            if (configValues.disabled || collecting) return;

            if (!hasFiles(event.dataTransfer)) return; // leave non-file drags untouched

            event.preventDefault(); // without this on dragover, the browser refuses the drop entirely
            event.dataTransfer!.dropEffect = "copy"; // show the green "+" copy cursor instead of a move/no-drop one
            setDraggingOver(true); // self-heal: dragover keeps firing, so the highlight recovers even if a dragenter was missed (e.g. after setDisabled toggling mid-drag)
        });
        registerEventListener(element, "dragleave", function () {
            if (--dragDepth <= 0) { // only switch off once we've left the zone AND all its children
                dragDepth = 0; // prevent the nested-entry counter from becoming negative
                setDraggingOver(false);
            }
        });
        registerEventListener(element, "drop", function (event) {
            if (configValues.disabled) return;

            if (!hasFiles(event.dataTransfer)) return; // leave non-file drops untouched

            event.preventDefault(); // prevent the browser from opening or navigating to the dropped file
            dragDepth = 0; // a drop fires no dragleave, so reset the counter by hand
            setDraggingOver(false);
            if (destroyed) return; // a highlight subscriber may tear down the engine
            if (!beginIntake()) return;

            const transfer = event.dataTransfer;

            if (transfer && transfer.items && transfer.items.length) { // prefer the items API because it supports dropped folders
                const folders: FolderCollection = {relativeFilePaths: relativeFilePaths, paths: []};
                collectDroppedFiles(transfer.items, folders).then(
                    function (files) {
                        if (!destroyed && !configValues.disabled) {
                            addFiles(files, folders.paths);
                        }
                    },
                    function (error) {
                        if (destroyed) return; // do not report after teardown

                        reportError("collect-failed", error instanceof Error ? error.message : "Unable to collect the dropped files.", {files: []});
                    }
                ).finally(finishIntake);
            } else {
                try {
                    addFiles(transfer?.files ?? []); // browser without items API: take the flat file list
                } finally {
                    finishIntake();
                }
            }
        });

        // Drag Reset — the zone's own dragleave handles leaving the zone; these cover what it can't see:
        // a drop anywhere (even outside the zone), and the window losing focus mid-drag (dragged out to another app)
        registerEventListener(element.ownerDocument, "drop", function () {
            resetDrag();
        });
        registerEventListener(element.ownerDocument.defaultView!, "blur", function () {
            resetDrag();
        });

        // Page Guard — prevent unhandled file drops from opening files or navigating the browser.
        registerEventListener(element.ownerDocument, "dragover", function (event) {
            if (event.defaultPrevented) return; // another drop target already handled this event
            if (!hasFiles(event.dataTransfer)) return; // leave non-file drags untouched

            event.preventDefault(); // claim the unhandled file drag so controlled drop behavior is permitted
            event.dataTransfer!.dropEffect = "none"; // nothing here accepts files — show a "can't drop" cursor
        });
        registerEventListener(element.ownerDocument, "drop", function (event) {
            if (event.defaultPrevented) return; // another drop target already handled this event
            if (!hasFiles(event.dataTransfer)) return; // leave non-file drops untouched

            event.preventDefault(); // stop the browser from opening or navigating to the dropped file
        });

        // File Picker
        registerEventListener(element, "click", function () {
            if (!configValues.openOnClickEnabled) return; // click-to-open is disabled by config

            openFilePicker();
        });
        registerEventListener(folderPicker, "change", function () {
            try {
                if (!configValues.disabled) addFiles(folderPicker.files ?? []);
            } finally {
                folderPicker.value = "";
                finishIntake();
            }
        });
        registerEventListener(filePicker, "change", function () {
            try {
                if (!configValues.disabled) addFiles(filePicker.files ?? []);
            } finally {
                filePicker.value = ""; // reset so the same file can be picked again next time
                finishIntake();
            }
        });
        registerEventListener(folderPicker, "cancel", finishIntake);
        registerEventListener(filePicker, "cancel", finishIntake);
    }

    function registerVideoThumbnailEventListeners(video: HTMLVideoElement, handleMetadata: () => void, handleSeeked: () => void, handleError: () => void): () => void {

        // Thumbnail metadata, seeking and decoding failures
        const removeMetadata = registerEventListener(video, "loadedmetadata", handleMetadata);
        const removeSeeked = registerEventListener(video, "seeked", handleSeeked);
        const removeError = registerEventListener(video, "error", handleError);

        return function removeVideoThumbnailEventListeners() {
            removeMetadata();
            removeSeeked();
            removeError();
        };
    }

    // endregion

    // region ----- State --------------------------------------------------------------------------------------------------
    const notifier = createNotifier(getState);
    let lastState: DropzoneState | null = null;
    let removeOnChange: (() => void) | null = null;

    const subscriptions = new WeakMap<(state: DropzoneState) => void, (state: DropzoneState) => void>();

    // Subscribe to collection changes. The listener gets the state on every change (not
    // immediately — read getState() for the first paint). Returns an unsubscribe function.
    function subscribe(listener: (state: DropzoneState) => void): () => void {
        if (typeof listener !== "function") {
            throw new TypeError(`createNotifier: 'listener' must be a function.`);
        }

        if (destroyed) return function unsubscribe() {}; // dead engine: nothing will fire, and nothing gets retained

        let wrapped = subscriptions.get(listener);

        if (!wrapped) {
            function callListener(state: DropzoneState) {
                listener({
                    ...state,
                    files: state.files.map(function (entry) {return {...entry};}),
                    ...(state.folderPaths && {folderPaths: state.folderPaths.map(function (path) {return [...path];})}),
                });
            }

            wrapped = callListener;
            subscriptions.set(listener, wrapped);
        }

        return notifier.subscribe(wrapped);
    }

    function notify() {
        if (configuration.isApplying()) return;
        if (destroyed) return;
        configuration.sync();
        if (destroyed) return;
        const state = getState();
        const previous = lastState;

        if (previous && state.config === previous.config && state.draggingOver === previous.draggingOver && state.collecting === previous.collecting && state.disabled === previous.disabled
            && state.count === previous.count && state.totalSize === previous.totalSize
            && state.files.every(function (entry, index) {
                const other = previous.files[index];
                return other && entry.file === other.file && entry.thumbnail === other.thumbnail && entry.videoPreview === other.videoPreview;
            }) && state.folderPaths?.length === previous.folderPaths?.length
            && (state.folderPaths ?? []).every(function (path, index) {
                const other = previous.folderPaths![index];
                return path.length === other.length && path.every(function (part, index) {return part === other[index];});
            })) return;

        lastState = state;
        notifier.notify();
    }

    // A snapshot of what the dropzone currently holds — consumers render from this.
    function getState(): DropzoneState {
        return {
            config: configuration.getSnapshot(),
            files: acceptedFiles.map(function (file) {
                return {
                    file: file,
                    thumbnail: thumbnailUrls.get(file) ?? null,
                    videoPreview: videoPreviews.get(file) ?? null
                };
            }),
            ...(acceptedFolderPaths.length && {folderPaths: acceptedFolderPaths.map(function (path) {return [...path];})}),
            count: acceptedFiles.length,
            totalSize: acceptedFiles.reduce(function (total, file) {
                return total + file.size;
            }, 0),
            draggingOver: isDraggingOver,
            collecting: collecting,
            disabled: configValues.disabled
        };
    }

    // endregion

    // region ----- Reactive Configuration ---------------------------------------------------------------------------------
    const configuration = createEngineConfig<DropzoneConfigFields, DropzoneReactiveConfig>({
        layout: configurationLayout,
        excludeSnapshot: ['document', 'source', 'src', 'sources'],
        values: configValues,
        validate: validateConfig,
        canApply: function () {return !destroyed;},
        apply: {
            accept: function (value) {filePicker.accept = value?.join(',') ?? ''; configValues.accept = value;},
            multipleEnabled: function (value) {filePicker.multiple = value; configValues.multipleEnabled = value;},
            disabled: setDisabled,
            videoPreviewEnabled: setVideoPreviewEnabled,
            imageThumbnailsEnabled: function (value) {setThumbnailsEnabled('imageThumbnailsEnabled', value, 'image/');},
            videoThumbnailsEnabled: function (value) {setThumbnailsEnabled('videoThumbnailsEnabled', value, 'video/');},
            audioThumbnailsEnabled: function (value) {setThumbnailsEnabled('audioThumbnailsEnabled', value, 'audio/');},
            onChange: function (value) {
                if (configValues.onChange === value) return;

                removeOnChange?.();
                configValues.onChange = value;
                removeOnChange = value ? subscribe(value) : null;
            },
            onError: function (value) {configValues.onError = value; reportError = createErrorReporter(value);},
        },
        notify: notify,
        reportFailure: function (_update, error) {if (!destroyed) {
            reportError('config-update-failed', error instanceof Error ? error.message : 'A dropzone setting could not be updated.', {files: []});
        }},
        cleanups: cleanups,
    });
    const reactiveConfig = configuration.config;

    // endregion

    // region ----- Error Handling -----------------------------------------------------------------------------------------
    let reportError = createErrorReporter(onError);

    // endregion

    // region ----- Settings -----------------------------------------------------------------------------------------------
    function setVideoPreviewEnabled(value: boolean) {
        if (configValues.videoPreviewEnabled === value) return;
        configValues.videoPreviewEnabled = value;
        const previous = videoPreviews.size;

        if (!value) revokeAllVideoPreviews();
        else for (const file of acceptedFiles) createVideoPreview(file);

        if (previous !== videoPreviews.size) notify();
    }

    function setThumbnailsEnabled(key: 'imageThumbnailsEnabled' | 'videoThumbnailsEnabled' | 'audioThumbnailsEnabled', value: boolean, prefix: string) {
        if (configValues[key] === value) return;
        configValues[key] = value;
        let changed = false;
        for (const file of acceptedFiles) {
            if (!file.type.startsWith(prefix)) continue;
            if (value) {void createThumbnail(file); continue;}
            changed = thumbnailUrls.has(file) || changed;
            pendingThumbnails.get(file)?.(null);
            revokeThumbnail(file);
        }
        if (changed) notify();
    }

    // endregion

    // region ----- Files --------------------------------------------------------------------------------------------------
    const acceptedFiles: File[] = []; // every file the dropzone currently holds, across all drops — the collection it owns
    const acceptedFolderPaths: string[][] = [];

    function getFileSize(file: File): {size: number; sizeFormatted: string} {
        return {
            size: file.size,
            sizeFormatted: formatBytes(file.size, 1000)
        };
    }

    // Remove one file from the "files" array; returns whether a file was actually removed
    function removeFile(file: File): boolean {
        if (destroyed) return false;

        const index = acceptedFiles.indexOf(file);
        if (index === -1) return false; // not held — nothing removed

        acceptedFiles.splice(index, 1);

        if (!acceptedFiles.includes(file)) {
            revokeThumbnail(file); // release previews when the last reference leaves
            revokeVideoPreview(file);
        }

        notify(); // the collection changed — tell subscribers
        return true;
    }

    // Remove all files from the "files" array
    function clearFiles(): void {
        if (destroyed) return;
        if (!acceptedFiles.length && !acceptedFolderPaths.length) return;
        acceptedFiles.length = 0; // empty the existing array without replacing its reference
        acceptedFolderPaths.length = 0;
        revokeAllThumbnails(); // release every minted thumbnail url
        revokeAllVideoPreviews(); // release every minted video preview url
        notify();
    }

    // The intake for every source — drops, the picker, and programmatic callers alike. Filters the files
    // through validate → dedupe → limits and commits files and folders only if the entire selection passes.
    // Takes a File, a FileList, or an array of File objects. Returns { accepted, errors }.
    function addFiles(files: File | FileList | File[], folderPaths: string[][] = []): DropzoneAddResult {
        if (destroyed) {
            return {accepted: [], errors: []}; // dead instance — nothing acquired
        }

        const normalizedFiles = files instanceof File ? [files] : files; // wrap a lone File so Array.from doesn't silently drop it
        const selectedFiles = normalizedFiles ? Array.from(normalizedFiles).filter(function (file) { return !isDSStore(file.name); }) : [];
        const {accepted: accepted, errors: errors} = validateFiles(selectedFiles);

        if (errors.length) {
            for (const error of errors) {
                if (destroyed) break;
                reportError(error.id, error.message, error.metadata);
            }

            return {accepted: [], errors: errors};
        }

        // A plain loop rather than push(...accepted), because spreading a very large batch into push() can overflow the argument-count limit.
        for (const file of accepted) {
            acceptedFiles.push(file);

            if (configValues.videoPreviewEnabled) {
                createVideoPreview(file);
            }

            createThumbnailIfEnabled(file);
        }

        for (const path of folderPaths) {
            acceptedFolderPaths.push(path);
        }

        // Collection grew — emit the new state to subscribers
        if (accepted.length || folderPaths.length) {
            notify();
        }

        return {accepted: accepted, errors: errors}; // report to programmatic callers; drop and pick ignore it
    }

    // Swap one held file for another in its place — for an edit flow (e.g. crop → save). Atomic: if the
    // replacement fails validation the original stays put and the reason fires at onError. Returns whether it swapped.
    function replaceFile(oldFile: File, newFile: File): boolean {
        if (destroyed) return false;

        // The replacement must be a File BEFORE we touch the collection — a Blob (e.g. from canvas.toBlob) or null
        // would throw inside validateFiles after the old file was already pulled, permanently losing it. Reject up front.
        if (!(newFile instanceof File)) {
            throw new TypeError(`createDropzone: replaceFile's replacement must be a File — convert a Blob via new File([blob], name, { type }).`);
        }

        if (isDSStore(newFile.name)) return false;

        const index = acceptedFiles.indexOf(oldFile);
        if (index === -1) return false; // not held — nothing to replace
        if (oldFile === newFile) return true; // identity is unchanged; preserve its cached previews

        acceptedFiles.splice(index, 1); // tentatively pull the old one so dedupe/limits judge the new one as if it's already gone
        const {accepted: accepted, errors: errors} = validateFiles([newFile]);

        if (accepted.length) {
            acceptedFiles.splice(index, 0, newFile); // drop the replacement into the same slot — position preserved

            if (!acceptedFiles.includes(oldFile)) {
                revokeThumbnail(oldFile); // release previews when the last reference leaves
                revokeVideoPreview(oldFile);
            }

            if (configValues.videoPreviewEnabled) {
                createVideoPreview(newFile);
            }

            createThumbnailIfEnabled(newFile);
            notify();
            return true;
        }

        acceptedFiles.splice(index, 0, oldFile); // rejected — restore the original in place; nothing changed
        for (const error of errors) {
            if (destroyed) break;
            reportError(error.id, error.message, error.metadata);
        }
        return false;
    }

    // Does the file's name end with one of these dotted extensions? Case-insensitive.
    // Used by both the 'accept' allowlist and the 'exclude' blocklist.
    // NOTE: matches on the filename only — a user-controlled, trivially-spoofable string.
    // accept/exclude are UX filters, NOT a security boundary; verify real file contents elsewhere.
    function hasExtension(file: File, extensions: string[]) {
        const name = file.name.toLowerCase();

        return extensions.some(function (extension: string) {
            return name.endsWith(extension.toLowerCase());
        });
    }

    // The names already held, lowercased — a path can't hold two files of the same name.
    function getExistingNames() {
        const names = new Set();
        for (const file of acceptedFiles) {
            names.add((getRelativeFilePath(file) || file.name).toLowerCase());
        }
        return names;
    }

    // How many times each (lowercased) name appears in a list of files.
    function getNameCounts(files: File[]) {
        const counts = new Map();
        for (const file of files) {
            const name = (getRelativeFilePath(file) || file.name).toLowerCase();
            counts.set(name, (counts.get(name) || 0) + 1);
        }
        return counts;
    }

    // Build one error record: a stable `id` (matching / i18n), a default human `message`, and the files
    // it concerns carried in `metadata` — the uniform {id, message, metadata} shape every engine fires.
    function createError<TId extends string>(id: TId, text: string, files: File[]): DropzoneError<TId> {
        return {id: id, message: text, metadata: {files: files}};
    }

    function validateFiles(files: File[]) {
        const errors = [];

        // Phase 1 — type and size. One file per message.
        const candidates = [];
        for (const file of files) {

            // if file type isn't accepted
            if (configValues.accept && !hasExtension(file, configValues.accept)) {
                errors.push(createError("invalid-extension", "This file type isn't accepted.", [file]));
                continue;
            }

            // if file type isn't allowed
            if (configValues.exclude && hasExtension(file, configValues.exclude)) {
                errors.push(createError("excluded-extension", `This file type isn't allowed. Blocked types: ${configValues.exclude.join(", ")}.`, [file]));
                continue;
            }

            // a 0-byte / empty file is never useful — always rejected, independent of minSize
            if (file.size === 0) {
                errors.push(createError("empty-file", "This file is empty.", [file]));
                continue;
            }

            // if file is below the minimum size
            if (configValues.minSize && file.size < configValues.minSize) {
                errors.push(createError("file-too-small", `This file is too small. Minimum size: ${formatBytes(configValues.minSize)}.`, [file]));
                continue;
            }

            // if file is too large
            if (configValues.maxSize && file.size > configValues.maxSize) {
                errors.push(createError("file-too-large", `This file is too large. Maximum size: ${formatBytes(configValues.maxSize)}.`, [file]));
                continue;
            }

            candidates.push(file);
        }

        // Phase 2 — dedupe by name. A name already in the collection, or appearing more
        // than once in this batch, is a path collision: none of the files sharing that
        // name get in. One message per clashing name, carrying every file that clashed.
        let accepted = candidates;

        if (configValues.dedupeEnabled) {
            accepted = [];
            const existingNames = getExistingNames();
            const candidateNameCounts = getNameCounts(candidates);
            const collidedByName = new Map(); // lowercased name -> the files that clashed on it

            for (const file of candidates) {
                const name = (getRelativeFilePath(file) || file.name).toLowerCase();
                const collides = existingNames.has(name) || candidateNameCounts.get(name) > 1;

                if (collides) {
                    const group = collidedByName.get(name) || [];
                    group.push(file);
                    collidedByName.set(name, group);
                    continue;
                }

                accepted.push(file);
            }

            for (const group of collidedByName.values()) {
                errors.push(createError("duplicate", `A file named "${group[0].name}" is a duplicate — it wasn't added.`, group));
            }
        }

        // Phase 3 — limits count every selected file, including files rejected above. Folders do not count.

        // one-file mode: any result past a single file is refused, not replaced
        if (!configValues.multipleEnabled && acceptedFiles.length + files.length > 1) {
            errors.push(createError("single-file", "Only one file can be selected at a time.", files));
        }

        // if the drop pushes the total count over the cap, block the whole drop (we can't pick which to keep)
        if (configValues.maxFiles && acceptedFiles.length + files.length > configValues.maxFiles) {
            errors.push(createError("max-files", `Too many files. At most ${configValues.maxFiles} can be added.`, files));
        }

        // if the drop pushes the combined size over the cap, block the whole drop
        if (configValues.maxTotalSize) {
            const totalSize = acceptedFiles.concat(files).reduce(function (total, file) {
                return total + file.size;
            }, 0);

            if (totalSize > configValues.maxTotalSize) {
                errors.push(createError("max-total-size", `These files exceed the total size limit of ${formatBytes(configValues.maxTotalSize)}.`, files));
            }
        }

        return {accepted: errors.length ? [] : accepted, errors: errors};
    }

    // endregion

    // region ----- Input Sources ------------------------------------------------------------------------------------------
    // State
    let isDraggingOver = false; // whether a file drag is currently over the zone (the highlighted state)
    let collecting = false;
    let dragDepth = 0; // how many nested elements the drag is currently inside. This is the counter that stops the highlight flickering as the cursor crosses child elements

    // Create a detached file input that opens the browser's native file-selection dialog.
    const filePicker = Object.assign(element.ownerDocument.createElement("input"), {
        type: "file",
        multiple: configValues.multipleEnabled,
        accept: configValues.accept ? configValues.accept.join(",") : "", // pass accepted extensions to the browser's picker filter
    });

    const folderPicker = Object.assign(element.ownerDocument.createElement("input"), {
        type: "file",
        multiple: true,
        webkitdirectory: true,
    });

    function beginIntake(): boolean {
        if (destroyed || configValues.disabled || collecting) return false;

        collecting = true;
        // Publish before opening a picker or walking directories so consumers can capture context.
        notify();
        if (destroyed || configValues.disabled) {
            finishIntake();
            return false;
        }
        return true;
    }

    function finishIntake(): void {
        if (!collecting) return;

        collecting = false;
        notify();
    }

    // State Helpers
    function setDraggingOver(value: boolean) {
        if (isDraggingOver === value) return; // already in that state — don't re-fire

        isDraggingOver = value;
        notify();
    }

    function resetDrag() {
        dragDepth = 0;
        setDraggingOver(false);
    }

    // Public control — disabling gates everything: drag and click-to-open.
    function setDisabled(value: boolean): void {
        if (destroyed || configValues.disabled === value) return;

        configValues.disabled = value;

        if (value) {
            dragDepth = 0;
            isDraggingOver = false; // publish disabling and clearing the highlight together
        }

        notify();
    }

    // Does the drag carry files? Leave non-file drags (text, links) untouched.
    function hasFiles(dataTransfer: DataTransfer | null) {
        return !!dataTransfer && Array.prototype.includes.call(dataTransfer.types, "Files");
    }

    // Open the native file picker when the dropzone is active.
    function openFilePicker(): void {
        if (!beginIntake()) return;

        try {
            filePicker.click();
        } catch (error) {
            finishIntake();
            reportError('collect-failed', error instanceof Error ? error.message : 'Unable to open the file picker.', {files: []});
        }
    }

    function openFolderPicker(): void {
        if (!beginIntake()) return;

        const view = element.ownerDocument.defaultView as (Window & {
            showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
        }) | null;

        if (view?.showDirectoryPicker) {
            void openDirectoryPicker(view.showDirectoryPicker.bind(view));
            return;
        }

        try {
            folderPicker.click();
        } catch (error) {
            finishIntake();
            reportError('collect-failed', error instanceof Error ? error.message : 'Unable to open the folder picker.', {files: []});
        }
    }

    async function openDirectoryPicker(pick: () => Promise<FileSystemDirectoryHandle>): Promise<void> {
        try {
            const directory = await pick();
            if (destroyed || configValues.disabled) return;

            const files: File[] = [];
            const folders: FolderCollection = {relativeFilePaths: relativeFilePaths, paths: []};
            await collectDirectoryHandle(directory, [directory.name], files, folders);
            if (!destroyed && !configValues.disabled) {
                addFiles(files, folders.paths);
            }
        } catch (error) {
            if (destroyed || configValues.disabled || (error instanceof DOMException && error.name === 'AbortError')) {
                return;
            }

            reportError('collect-failed', error instanceof Error ? error.message : 'Unable to read the selected folder.', {files: []});
        } finally {
            finishIntake();
        }
    }

    // endregion

    // region ----- Previews -----------------------------------------------------------------------------------------------
    const pendingThumbnails = new Map<File, (url: string | null) => void>(); // in-flight video-thumbnail finishers, so destroy() can cancel a decode mid-flight
    const thumbnails = new Map<File, Promise<string | null>>(); // file -> Promise of its thumbnail url; the dropzone revokes these when files leave
    const thumbnailUrls = new Map<File, string>();
    const videoPreviews = new Map<File, string>(); // file -> video object url; the dropzone revokes these when files leave

    function createThumbnailIfEnabled(file: File) {
        if ((configValues.imageThumbnailsEnabled && file.type.startsWith("image/")) ||
            (configValues.videoThumbnailsEnabled && file.type.startsWith("video/")) ||
            (configValues.audioThumbnailsEnabled && file.type.startsWith("audio/"))) {
            createThumbnail(file);
        }
    }

    // Build (or reuse) a thumbnail URL for a file. The dropzone OWNS the URL and revokes it when the file
    // leaves the collection — callers just render it and never revoke. Repeat calls reuse the same one.
    function createThumbnail(file: File): Promise<string | null> {
        if (destroyed) return Promise.resolve(null); // don't start new decode work after teardown
        if (thumbnails.has(file)) return thumbnails.get(file)!; // reuse the in-flight or finished result

        const thumbnail = resolveThumbnail(file).then(function (url) {

            // The file left mid-decode — drop the url now rather than leak it.
            if (url && (destroyed || !acceptedFiles.includes(file) || thumbnails.get(file) !== thumbnail)) {
                URL.revokeObjectURL(url);
                return null;
            }

            if (url) {
                thumbnailUrls.set(file, url);
                notify();
            }

            return url;
        }, function () {
            if (!destroyed && acceptedFiles.includes(file) && thumbnails.get(file) === thumbnail) {
                reportError("thumbnail-failed", `Unable to preview ${file.name}.`, {files: [file]});
            }

            return null;
        });

        thumbnails.set(file, thumbnail);
        return thumbnail;
    }

    // Build (or reuse) a playable video preview URL for a file.
    function createVideoPreview(file: File): string | null {
        if (destroyed) return null;
        if (!configValues.videoPreviewEnabled) return null;
        if (!file.type.startsWith("video/")) return null;

        if (videoPreviews.has(file)) {
            return videoPreviews.get(file)!;
        } // reuse the existing object url

        const videoPreviewUrl = URL.createObjectURL(file);

        videoPreviews.set(file, videoPreviewUrl);
        return videoPreviewUrl;
    }

    // Images use their own data; videos yield a frame; audio can supply embedded artwork.
    async function resolveThumbnail(file: File) {
        if (file.type.startsWith("image/")) { // images can be displayed directly without generating a new preview
            return URL.createObjectURL(file); // the image itself is the thumbnail
        }

        if (file.type.startsWith("video/")) { // videos require extracting a frame to use as their thumbnail
            return createVideoThumbnail(file); // extract frame from video, use frame as thumbnail
        }

        if (file.type.startsWith("audio/")) {
            return createAudioThumbnail(file); // extract supported embedded album artwork
        }

        return null; // nothing to use as thumbnail (e.g., a PDF, a ZIP, etc.)
    }

    // Revoke and forget a file's thumbnail — called when the file leaves the collection.
    function revokeThumbnail(file: File) {
        thumbnailUrls.delete(file);
        const thumbnail = thumbnails.get(file);
        if (!thumbnail) return;

        thumbnails.delete(file);
        thumbnail.then(function (url: string | null) {
            if (url) URL.revokeObjectURL(url);
        });
    }

    // Revoke and forget a file's video preview — called when the file leaves the collection.
    function revokeVideoPreview(file: File) {
        const videoPreviewUrl = videoPreviews.get(file);
        if (!videoPreviewUrl) return;

        videoPreviews.delete(file);
        URL.revokeObjectURL(videoPreviewUrl);
    }

    // Revoke and forget every thumbnail the dropzone minted — for clear-all and teardown.
    function revokeAllThumbnails() {
        for (const file of [...thumbnails.keys()]) {
            revokeThumbnail(file);
        }
    }

    // Revoke and forget every video preview the dropzone minted — for clear-all and teardown.
    function revokeAllVideoPreviews() {
        for (const file of [...videoPreviews.keys()]) {
            revokeVideoPreview(file);
        }
    }

    // Generate a thumbnail by loading the video, seeking to a frame, and drawing it onto a canvas.
    function createVideoThumbnail(file: File): Promise<string | null> {
        return new Promise(function (resolve) {
            const sourceUrl = URL.createObjectURL(file); // the video is read straight from this blob url
            const video = element.ownerDocument.createElement("video"); // detached element, never added to the page
            let settled = false; // "seeked" can fire repeatedly, and "error" can follow — capture and resolve only once

            // Stop waiting if the video cannot produce a thumbnail within ten seconds.
            const thumbnailTimeout = setTimeout(function () {
                settleWith(null); // abandon thumbnail generation and clean up its resources
            }, 10000);

            video.muted = true; // we don't want noise playing
            video.preload = "auto"; // fetch enough of the file to reach a seekable frame

            // Finish at once, release the source video URL, and resolve the thumbnail result.
            function settleWith(thumbnailUrl: string | null) {
                if (settled) return; // ignore duplicate timeout, media, or canvas callbacks

                settled = true; // prevent any later callback from completing the operation again

                if (pendingThumbnails.get(file) === settleWith) {
                    pendingThumbnails.delete(file);
                } // this decode is finishing — drop it from the in-flight set

                clearTimeout(thumbnailTimeout); // cancel the timeout after success or an earlier failure
                removeThumbnailEventListeners(); // release the listeners and their references when this decode finishes
                video.pause(); // stop the video reading the blob
                video.removeAttribute("src"); // remove the source URL
                video.load(); // aborts the video's in-flight reads of the blob; revoking only after that avoids ERR_FILE_NOT_FOUND errors from reads that would otherwise still be pointing at a url we already revoked
                URL.revokeObjectURL(sourceUrl); // safe now: nothing is reading the blob anymore
                resolve(thumbnailUrl);
            }

            // Wait until video duration and seeking information are available.
            function handleMetadata() {
                if (settled) return; // ignore metadata arriving after timeout or failure

                const durationIsUsable = Number.isFinite(video.duration) && video.duration > 0; // some encoders report Infinity/NaN

                if (durationIsUsable) {
                    video.currentTime = Math.min(3, video.duration / 2); // 3s in, or near the start otherwise
                } else {
                    video.currentTime = 0.1; // attempt a frame near the beginning when duration is unavailable
                }
            }

            // Capture the video frame after seeking reaches the requested time.
            function handleSeeked() {
                if (settled) return; // ignore seek completion after timeout or failure

                const canvas = element.ownerDocument.createElement("canvas"); // create a detached canvas for the captured frame
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const context = canvas.getContext("2d");

                if (!context) { // stop when the browser cannot provide a canvas drawing context
                    settleWith(null);
                    return;
                }

                try {
                    context.drawImage(video, 0, 0, canvas.width, canvas.height); // copy the decoded frame into the canvas
                } catch {
                    settleWith(null); // fail cleanly if the decoded frame cannot be drawn
                    return;
                }

                // Convert the captured canvas frame into a thumbnail image blob.
                canvas.toBlob(function (blob) {
                    if (settled) return; // avoid creating a thumbnail URL after timeout or failure

                    settleWith(blob ? URL.createObjectURL(blob) : null); // return the thumbnail URL when blob creation succeeds
                });
            }

            // Handle video loading or decoding failure.
            function handleError() {
                settleWith(null); // couldn't decode — no thumbnail
            }

            pendingThumbnails.set(file, settleWith); // register this decode so destroy() can tear it down before its 10s timeout
            const removeThumbnailEventListeners = registerVideoThumbnailEventListeners(video, handleMetadata, handleSeeked, handleError);
            video.src = sourceUrl; // begin loading only after every required event listener is registered
        });
    }

    // Read ordinary ID3v2.3/v2.4 JPEG/PNG artwork; unsupported tag variations return no thumbnail.
    async function createAudioThumbnail(file: File): Promise<string | null> {
        try {
            const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());

            if (destroyed || header.length !== 10 || String.fromCharCode(...header.subarray(0, 3)) !== "ID3") {
                return null;
            }

            const version = header[3];

            // Keep this parser small: skip extended, unsynchronised, experimental, and footer-bearing tags.
            if ((version !== 3 && version !== 4) || header[4] !== 0 || header[5] !== 0) {
                return null;
            }

            const sizeBytes = header.subarray(6, 10);

            if (sizeBytes.some(function (byte) {return byte & 0x80;})) {
                return null;
            }

            const tagSize = sizeBytes.reduce(function (size, byte) {return size * 128 + byte;}, 0);
            if (tagSize < 10 || tagSize > file.size - 10) return null;

            // Read only the declared metadata section, leaving the audio data untouched.
            const data = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
            if (destroyed || data.length !== tagSize) return null;

            let fallback = null;

            for (let offset = 0; offset + 10 <= data.length;) {
                if (data[offset] === 0) break; // tag padding

                const id = String.fromCharCode(...data.subarray(offset, offset + 4));
                if (!/^[A-Z0-9]{4}$/.test(id)) return null;

                const frameSizeBytes = data.subarray(offset + 4, offset + 8);

                if (version === 4 && frameSizeBytes.some(function (byte) {return byte & 0x80;})) {
                    return null;
                }

                const frameSize = frameSizeBytes.reduce(function (size, byte) {return size * (version === 4 ? 128 : 256) + byte;}, 0);
                const flags = data[offset + 9];
                const end = offset + 10 + frameSize;
                if (frameSize === 0 || end > data.length) return null;

                const frame = data.subarray(offset + 10, end);
                offset = end;
                if (id !== "APIC" || flags !== 0) continue; // skip transformed frames (compression, encryption, etc.)

                const encoding = frame[0];
                if (encoding > (version === 3 ? 1 : 3)) continue;

                const mimeEnd = frame.indexOf(0, 1);

                if (mimeEnd < 2 || mimeEnd > 32 || mimeEnd + 2 >= frame.length) {
                    continue;
                }

                const mime = String.fromCharCode(...frame.subarray(1, mimeEnd)).toLowerCase();
                if (mime !== "image/jpeg" && mime !== "image/png") continue;

                const pictureType = frame[mimeEnd + 1];
                const terminatorSize = encoding === 1 || encoding === 2 ? 2 : 1;
                let imageStart = mimeEnd + 2;

                // UTF-16 descriptions must be scanned on two-byte boundaries.
                while (imageStart + terminatorSize <= frame.length) {
                    if (frame[imageStart] === 0 && (terminatorSize === 1 || frame[imageStart + 1] === 0)) {
                        break;
                    }

                    imageStart += terminatorSize;
                }

                imageStart += terminatorSize;
                if (imageStart >= frame.length) continue;

                const picture = frame.subarray(imageStart);
                const isJpeg = picture.length >= 3 && picture[0] === 0xff && picture[1] === 0xd8 && picture[2] === 0xff;
                const isPng = picture.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every(function (byte, index) {return picture[index] === byte;});

                if ((mime === "image/jpeg" && !isJpeg) || (mime === "image/png" && !isPng)) {
                    continue;
                }

                if (pictureType === 3) { // prefer the front cover over other attached pictures
                    return URL.createObjectURL(new Blob([picture], {type: mime}));
                }

                if (!fallback) fallback = new Blob([picture], {type: mime});
            }

            return fallback ? URL.createObjectURL(fallback) : null;
        } catch {
            return null; // unreadable or malformed tags leave the file's icon as its preview
        }
    }

    // endregion

    // region ----- Destroy ------------------------------------------------------------------------------------------------
    // Tears down the whole dropzone: runs every registered cleanup, detaching all listeners it attached.
    function destroy(): void {
        if (destroyed) return;

        destroyed = true; // prevent further work and make future destroy calls harmless
        collecting = false;
        notifier.destroy();

        cleanups.forEach(function (cleanup) {
            cleanup();
        });

        cleanups.length = 0; // release references to the cleanup functions and their event targets
        resetDrag(); // clear the drag counter without notifying after teardown

        // Cancel any in-flight thumbnail decodes — otherwise a detached <video> keeps decoding until its
        // own 10s timeout. settleWith is idempotent, so this just tears each one down now (resolving it null).
        for (const settleThumbnail of [...pendingThumbnails.values()]) {
            settleThumbnail(null); // forces settleWith → pause/load/revoke/clearTimeout, removes itself from the set
        }

        revokeAllThumbnails(); // revoke every thumbnail url the dropzone minted
        revokeAllVideoPreviews(); // revoke every video preview url the dropzone minted
    }

    // endregion

    init();

    return {
        config: reactiveConfig,
        getState: getState,
        subscribe: subscribe,
        addFiles: addFiles,
        removeFile: removeFile,
        clearFiles: clearFiles,
        replaceFile: replaceFile,
        getFileSize: getFileSize,
        getFolderPath: getFolderPath,
        openFilePicker: openFilePicker,
        openFolderPicker: openFolderPicker,
        createThumbnail: createThumbnail,
        createVideoPreview: createVideoPreview,
        destroy: destroy
    };
}

// region ----- Generic Helpers ----------------------------------------------------------------------------------------
function formatBytes(bytes: number, base = 1024) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;

    while (size >= base && unit < units.length - 1) {
        size = size / base;
        unit++;
    }

    return `${size.toFixed(1)} ${units[unit]}`;
}

// endregion

// region ----- File Collection ----------------------------------------------------------------------------------------
type FolderCollection = {
    relativeFilePaths: WeakMap<File, string>
    paths: string[][]
};

async function collectDirectoryHandle(directory: FileSystemDirectoryHandle, path: string[], files: File[], folders: FolderCollection): Promise<void> {
    const readableDirectory = directory as FileSystemDirectoryHandle & {
        values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>
    };
    folders.paths.push(path);

    for await (const entry of readableDirectory.values()) {
        const entryPath = [...path, entry.name];

        if (entry.kind === 'directory') {
            await collectDirectoryHandle(entry, entryPath, files, folders);
        } else if (!isDSStore(entry.name)) {
            const file = await entry.getFile();
            folders.relativeFilePaths.set(file, entryPath.join('/'));
            files.push(file);
        }
    }
}

async function collectDroppedFiles(dataTransferItems: DataTransferItemList, folders: FolderCollection): Promise<File[]> {
    const fileCollectionPromises = [];

    for (let index = 0; index < dataTransferItems.length; index++) {
        const dataTransferItem = dataTransferItems[index];

        // Convert the dropped item into a file-or-folder entry when the browser supports it
        const fileSystemEntry = dataTransferItem.webkitGetAsEntry
            ? dataTransferItem.webkitGetAsEntry() // retrieve the entry for recursive file or folder processing
            : null; // no entry API is available, so the caller must use the regular File fallback

        if (fileSystemEntry) {
            fileCollectionPromises.push(
                collectFilesFromFileSystemEntry(fileSystemEntry, folders) // recursively collect every file contained by the entry
            );
            continue;
        }

        if (dataTransferItem.kind === "file") {
            const file = dataTransferItem.getAsFile();

            if (file) {
                fileCollectionPromises.push(
                    Promise.resolve([file]) // match the Promise-of-File-array shape returned by entry extraction
                );
            } else {
                fileCollectionPromises.push(Promise.reject(new Error("Unable to read a dropped file.")));
            }
        }
    }

    const collectedFileGroups = await Promise.all(fileCollectionPromises);
    return collectedFileGroups.flat();
}

async function collectFilesFromFileSystemEntry(fileSystemEntry: FileSystemEntry, folders: FolderCollection, parentPath: string[] = []): Promise<File[]> {
    const path = [...parentPath, fileSystemEntry.name];

    if (fileSystemEntry.isFile) {
        if (isDSStore(fileSystemEntry.name)) return [];

        return new Promise(function (resolve, reject) {
            (fileSystemEntry as FileSystemFileEntry).file(
                function (file) {
                    if (parentPath.length) {
                        folders.relativeFilePaths.set(file, path.join('/'));
                    }

                    resolve([file]); // return the file inside an array to match the folder-extraction result shape
                },
                reject
            );
        });
    }

    const directoryReader = (fileSystemEntry as FileSystemDirectoryEntry).createReader(); // create a reader that retrieves the directory's child file-system entries in batches
    const collectedFiles: File[] = [];
    folders.paths.push(path);

    while (true) {
        // Readers return batches; a failure anywhere rejects the entire selection.
        const children = await new Promise<FileSystemEntry[]>(function (resolve, reject) {
            directoryReader.readEntries(resolve, reject);
        });

        if (!children.length) return collectedFiles;

        const groups = await Promise.all(children.map(function (child) {
            return collectFilesFromFileSystemEntry(child, folders, path);
        }));

        // Avoid spreading a large directory into push(), which can exceed the argument-count limit.
        for (const file of groups.flat()) {
            collectedFiles.push(file);
        }
    }
}

// endregion

function isValidExtensionList(value: unknown): value is string[] {
    return Array.isArray(value) && value.length > 0 && value.every(function (extension) {
        return typeof extension === "string" && Boolean(extension.trim()) && extension === extension.trim() && extension.startsWith(".");
    });
}

const configurationLayout = {
    accept: {path: ["files","accept"], optional: true},
    exclude: {path: ["files","exclude"], optional: true},
    minSize: {path: ["files","limits","minSize"], optional: true},
    maxSize: {path: ["files","limits","maxSize"], optional: true},
    maxFiles: {path: ["files","limits","maxFiles"], optional: true},
    maxTotalSize: {path: ["files","limits","maxTotalSize"], optional: true},
    multipleEnabled: {path: ["files","multiple","enabled"]},
    openOnClickEnabled: {path: ["picker","openOnClick","enabled"]},
    disabled: {path: ["enabled"], inverted: true},
    dedupeEnabled: {path: ["files","dedupe","enabled"]},
    videoPreviewEnabled: {path: ["previews","video","enabled"]},
    imageThumbnailsEnabled: {path: ["thumbnails","image","enabled"]},
    videoThumbnailsEnabled: {path: ["thumbnails","video","enabled"]},
    audioThumbnailsEnabled: {path: ["thumbnails","audio","enabled"]},
    onChange: {path: ["events","onChange"], optional: true},
    onError: {path: ["events","onError"], optional: true},
} as const;
