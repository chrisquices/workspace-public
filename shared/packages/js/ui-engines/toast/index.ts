import {callConsumer, createNotifier, createErrorReporter} from 'workspace-packages/ui-engines/shared/core';
import type {ToastReactiveConfig} from 'workspace-packages/ui-engines/toast/types';
import {captureEngineConfig, createEngineConfig} from 'workspace-packages/ui-engines/shared/engine-config';
import type {ConfigUpdate} from 'workspace-packages/ui-engines/shared/types';
import type {ToastOptions, ToastEngine, ToastConfigFields, ToastState, ToastContent, ToastInput, ToastPatch, ToastSnapshot, ToastReference, ToastTarget, ToastId, ToastEntry, ToastTimerKind, ToastPromiseOptions, ToastPromiseHandle} from 'workspace-packages/ui-engines/toast/types';

export type {ToastConfigSnapshot, ToastId, ToastVariant, ToastStatus, ToastReference, ToastTarget, ToastContent, ToastInput, ToastPatch, ToastSnapshot, ToastState, ToastError, ToastConfig, ToastReactiveConfig, ToastOptions, ToastPromiseOptions, ToastPromiseHandle, ToastEngine} from 'workspace-packages/ui-engines/toast/types';

// The engine owns admission, expiry and automatic removal independently of rendering.
// References identify a lifetime within this engine; delayed callers must retain both.
export function createToaster<T = unknown>(options: ToastOptions<T>): ToastEngine<T> {

    // region ----- Configuration ------------------------------------------------------------------------------------------
    validateOptions();

    const {element: hostElement, config: config} = options;
    const {
        limits: {
            maxVisible: maxVisible = 3,
        } = {},
        timing: {
            durationMs: durationMs = 5000,
            removalDelayMs: removalDelayMs = 0,
        } = {},
        events: {
            onChange: onChange,
            onError: onError,
        } = {},
    } = config;

    validateConfig();

    function validateOptions() {
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError(`createToaster: 'options' must be an object.`);
        }

        if (options.element !== null && (!options.element || options.element.nodeType !== 1 || !options.element.ownerDocument)) {
            throw new TypeError(`createToaster: 'element' must be a DOM element or null.`);
        }

        if (!options.config || typeof options.config !== 'object' || Array.isArray(options.config)) {
            throw new TypeError(`createToaster: 'config' must be an options object.`);
        }

        options = {...options, config: captureEngineConfig(options.config, configurationLayout)};
    }

    function validateConfig(update?: ConfigUpdate<keyof ToastConfigFields<T>>) {
        if (update) {
            if (destroyed) return false;
            const values = {...configValues, ...(update.values as Partial<ToastConfigFields<T>>), [update.key]: update.value};

            if (!Number.isSafeInteger(values.maxVisible) || values.maxVisible < 1) {
                throw new TypeError(`limits.maxVisible must be a positive safe integer.`);
            }

            if (typeof values.durationMs !== 'number' || !Number.isFinite(values.durationMs) || values.durationMs < 0 || values.durationMs > 2147483647) {
                throw new TypeError(`timing.durationMs must be finite milliseconds from 0 through 2147483647.`);
            }

            if (typeof values.removalDelayMs !== 'number' || !Number.isFinite(values.removalDelayMs) || values.removalDelayMs < 0 || values.removalDelayMs > 2147483647) {
                throw new TypeError(`timing.removalDelayMs must be finite milliseconds from 0 through 2147483647.`);
            }

            if (values.onChange !== undefined && typeof values.onChange !== 'function') {
                throw new TypeError(`events.onChange must be a function when provided.`);
            }

            if (values.onError !== undefined && typeof values.onError !== 'function') {
                throw new TypeError(`events.onError must be a function when provided.`);
            }

            return !destroyed;
        }

        if (!Number.isSafeInteger(maxVisible) || maxVisible < 1) {
            throw new TypeError(`limits.maxVisible must be a positive safe integer.`);
        }

        if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 2147483647) {
            throw new TypeError(`timing.durationMs must be finite milliseconds from 0 through 2147483647.`);
        }

        if (typeof removalDelayMs !== 'number' || !Number.isFinite(removalDelayMs) || removalDelayMs < 0 || removalDelayMs > 2147483647) {
            throw new TypeError(`timing.removalDelayMs must be finite milliseconds from 0 through 2147483647.`);
        }

        if (onChange !== undefined && typeof onChange !== 'function') {
            throw new TypeError(`events.onChange must be a function when provided.`);
        }

        if (onError !== undefined && typeof onError !== 'function') {
            throw new TypeError(`events.onError must be a function when provided.`);
        }
    }

    // endregion

    // region ----- Init ---------------------------------------------------------------------------------------------------
    const configValues: ToastConfigFields<T> = {
        maxVisible: maxVisible,
        durationMs: durationMs,
        removalDelayMs: removalDelayMs,
        onChange: onChange,
        onError: onError,
    };
    let destroyed = false;

    function init() {
        try {
            registerAllEventListeners();
            notifier.subscribe(function () {
                if (configValues.onChange) {
                    callConsumer(configValues.onChange, getState());
                }
            });
            notify();
        } catch (error) {
            destroy();
            throw error;
        }
    }

    // endregion

    // region ----- Event Listeners ----------------------------------------------------------------------------------------
    const cleanups: (() => void)[] = [];

    function registerEventListener(): void {

        // Reserved by the shared engine layout; the host anchor is inert.
    }

    function registerAllEventListeners(): void {

        // Consumers translate their own events into explicit engine actions.
    }

    // endregion

    // region ----- State --------------------------------------------------------------------------------------------------
    const notifier = createNotifier<ToastState<T>, number>(getState);
    const subscribers = new Map<(state: ToastState<T>) => void, () => void>();
    let lastEmittedState: ToastState<T> | null = null;

    function subscribe(listener: (state: ToastState<T>) => void): () => void {
        if (destroyed) return function unsubscribe() {};

        if (typeof listener !== 'function') {
            throw new TypeError(`createToaster: 'listener' must be a function.`);
        }

        const existing = subscribers.get(listener);
        if (existing) return existing;
        const unsubscribeNotifier = notifier.subscribe(callListener);
        let subscribed = true;
        subscribers.set(listener, unsubscribe);
        return unsubscribe;

        function callListener() {
            callConsumer(listener, getState());
        }

        function unsubscribe() {
            if (!subscribed) return;
            subscribed = false;
            unsubscribeNotifier();
            subscribers.delete(listener);
        }
    }

    function notify(): void {
        if (configuration.isApplying()) return;
        if (destroyed) return;
        configuration.sync();
        const configChanged = configuration.hasChanges();
        if (destroyed) return;
        const state = getState();
        const previous = lastEmittedState;

        if (!configChanged && previous && state.maxVisible === previous.maxVisible && state.paused === previous.paused
            && state.visible.length === previous.visible.length && state.queued.length === previous.queued.length
            && state.visible.every(function (snapshot, index) {return isSameToast(snapshot, previous.visible[index]);})
            && state.queued.every(function (snapshot, index) {return isSameToast(snapshot, previous.queued[index]);})) {
            return;
        }

        lastEmittedState = state;
        notifier.notify();
    }

    function getState(): ToastState<T> {
        return {
            config: configuration.getSnapshot(),
            visible: visibleIds.map(function (id) {return getToastCopy(entries.get(id)!.snapshot);}),
            queued: queuedIds.map(function (id) {return getToastCopy(entries.get(id)!.snapshot);}),
            maxVisible: configValues.maxVisible,
            paused: pauseReasons.size > 0,
            destroyed: destroyed,
        };
    }

    // endregion

    // region ----- Reactive Configuration ---------------------------------------------------------------------------------
    const configuration = createEngineConfig<ToastConfigFields<T>, ToastReactiveConfig<T>>({
        layout: configurationLayout,
        excludeSnapshot: ['document', 'source', 'src', 'sources'],
        values: configValues,
        validate: validateConfig,
        canApply: function () {return !destroyed;},
        apply: {
            maxVisible: setMaxVisible,
            durationMs: setDefaultDuration,
            removalDelayMs: setDefaultRemovalDelay,
            onChange: function (value) {configValues.onChange = value;},
            onError: function (value) {configValues.onError = value; reportError = createErrorReporter(value);},
        },
        notify: notify,
        reportFailure: function (update, error) {
            if (destroyed) return;
            reportError('config-update-failed', 'A toast setting could not be updated.', {key: update.key, error: error});
        },
        cleanups: cleanups,
    });
    const reactiveConfig = configuration.config;

    function setDefaultDuration(value: number): void {
        configValues.durationMs = value;
    }

    function setDefaultRemovalDelay(value: number): void {
        configValues.removalDelayMs = value;
    }

    // endregion

    // region ----- Error Handling -----------------------------------------------------------------------------------------
    let reportError = createErrorReporter(onError);

    // endregion

    // region ----- Records ------------------------------------------------------------------------------------------------
    const entries = new Map<ToastId, ToastEntry<T>>();
    let nextId = 0;
    let nextGeneration = 0;
    let nextSequence = 0;

    function createToast(input: ToastInput<T>): ToastReference | null {
        if (destroyed) return null;
        const id = getInputId(input);
        const previous = id === undefined ? undefined : entries.get(id);
        const patch = getToastInput(input, true);

        if (!isCurrentAdmission(id, previous)) return null;

        const entry = previous ?? createEntry(id, patch);

        if (previous) {
            applyToastPatch(entry, patch);
        }

        const reference = getReference(entry);
        syncQueue();
        notify();
        return reference;
    }

    function setToast(target: ToastTarget, patch: ToastPatch<T>): boolean {
        if (destroyed) return false;
        const entry = getEntry(target);

        if (!entry || entry.snapshot.status === 'dismissing') {
            return false;
        }

        const captured = getToastInput(patch);

        if (!isCurrentAdmission(entry.snapshot.id, entry)) {
            return false;
        }

        const changed = applyToastPatch(entry, captured);
        syncQueue();
        notify();
        return changed;
    }

    function getToast(target: ToastTarget): ToastSnapshot<T> | null {
        if (destroyed) return null;
        const entry = getEntry(target);
        return entry ? getToastCopy(entry.snapshot) : null;
    }

    function hasToast(target: ToastTarget): boolean {
        if (destroyed) return false;
        return getEntry(target) !== undefined;
    }

    function getInputId(input: ToastInput<T>): ToastId | undefined {
        validateToastRecord(input);
        if (!('id' in input)) return undefined;
        const id = input.id;

        if (typeof id !== 'string' || id.length === 0) {
            throw new TypeError(`id must be a non-empty string when provided.`);
        }

        return id;
    }

    function getToastInput(input: ToastPatch<T>, allowId = false): ToastPatch<T> {
        validateToastRecord(input);

        for (const key of ['id', 'generation', 'status', 'removalDelayMs', 'paused']) {
            if ((key !== 'id' || !allowId) && key in input) {
                throw new TypeError(`Toast content cannot write '${key}'.`);
            }
        }

        const captured: ToastPatch<T> = {};

        for (const key of ['title', 'description', 'variant', 'durationMs', 'priority', 'data'] as const) {
            if (key in input) {
                Reflect.set(captured, key, input[key]);
            }
        }

        validateToast(captured);
        return captured;
    }

    function validateToastRecord(input: unknown): void {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new TypeError(`Toast content must be an object.`);
        }
    }

    function validateToast(input: ToastPatch<T>): void {
        if ('title' in input && typeof input.title !== 'string') {
            throw new TypeError(`title must be a string when provided.`);
        }

        if ('description' in input && typeof input.description !== 'string') {
            throw new TypeError(`description must be a string when provided.`);
        }

        if ('variant' in input && !['info', 'success', 'warning', 'error', 'loading'].includes(input.variant!)) {
            throw new TypeError(`variant must be info, success, warning, error, or loading.`);
        }

        if ('durationMs' in input && (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > 2147483647)) {
            throw new TypeError(`timing.durationMs must be finite milliseconds from 0 through 2147483647.`);
        }

        if ('priority' in input && (typeof input.priority !== 'number' || !Number.isFinite(input.priority))) {
            throw new TypeError(`priority must be a finite number when provided.`);
        }
    }

    function getEntry(target: ToastTarget): ToastEntry<T> | undefined {
        let id: string;
        let generation: number | undefined;

        if (typeof target === 'string') {
            id = target;
        } else {
            if (!target || typeof target !== 'object' || Array.isArray(target)) {
                throw new TypeError(`Toast target must be an ID or generation-qualified reference.`);
            }

            id = target.id;
            generation = target.generation;

            if (!Number.isSafeInteger(generation) || generation < 1) {
                throw new TypeError(`Toast reference generation must be a positive safe integer.`);
            }
        }

        if (typeof id !== 'string' || id.length === 0) {
            throw new TypeError(`Toast target ID must be a non-empty string.`);
        }

        if (destroyed) return undefined;
        const entry = entries.get(id);
        return generation === undefined || entry?.snapshot.generation === generation ? entry : undefined;
    }

    function isCurrentAdmission(id: ToastId | undefined, previous: ToastEntry<T> | undefined): boolean {
        return !destroyed && (id === undefined || entries.get(id) === previous) && previous?.snapshot.status !== 'dismissing';
    }

    function createEntry(id: ToastId | undefined, input: ToastPatch<T>): ToastEntry<T> {
        if (id === undefined) {
            do {
                id = `toast-${++nextId}`;
            } while (entries.has(id));
        }

        const ordinaryDurationMs = input.durationMs ?? configValues.durationMs;
        const variant = input.variant ?? 'info';
        const effectiveDurationMs = variant === 'loading' ? 0 : ordinaryDurationMs;
        const entry: ToastEntry<T> = {
            snapshot: {
                id: id,
                generation: ++nextGeneration,
                status: 'queued',
                title: input.title ?? '',
                description: input.description ?? '',
                variant: variant,
                durationMs: effectiveDurationMs,
                removalDelayMs: configValues.removalDelayMs,
                paused: pauseReasons.size > 0,
                priority: input.priority ?? 0,
                data: input.data,
            },
            ordinaryDurationMs: ordinaryDurationMs,
            remainingMs: effectiveDurationMs,
            pauseReasons: new Set<string>(),
            timer: {handle: null, kind: null, revision: 0, deadline: null},
            sequence: ++nextSequence,
            promiseToken: null,
        };
        entries.set(id, entry);
        queuedIds.push(id);
        return entry;
    }

    function applyToastPatch(entry: ToastEntry<T>, patch: ToastPatch<T>): boolean {
        const previous = entry.snapshot;
        const ordinaryDurationMs = patch.durationMs ?? entry.ordinaryDurationMs;
        const variant = patch.variant ?? previous.variant;
        const snapshot: ToastSnapshot<T> = {
            ...previous,
            title: patch.title ?? previous.title,
            description: patch.description ?? previous.description,
            variant: variant,
            durationMs: variant === 'loading' ? 0 : ordinaryDurationMs,
            priority: patch.priority ?? previous.priority,
            data: Object.hasOwn(patch, 'data') ? patch.data : previous.data,
        };
        const reset = Object.hasOwn(patch, 'durationMs') || (previous.durationMs === 0) !== (snapshot.durationMs === 0);
        const changed = !isSameToast(previous, snapshot) || reset || entry.promiseToken !== null;
        entry.snapshot = snapshot;
        entry.ordinaryDurationMs = ordinaryDurationMs;
        entry.promiseToken = null;
        syncExpiry(entry, reset);
        return changed;
    }

    function getReference(entry: ToastEntry<T>): ToastReference {
        return {id: entry.snapshot.id, generation: entry.snapshot.generation};
    }

    function getToastCopy(snapshot: ToastSnapshot<T>): ToastSnapshot<T> {
        return {...snapshot};
    }

    function isSameToast(left: ToastSnapshot<T>, right: ToastSnapshot<T>): boolean {
        return left.id === right.id && left.generation === right.generation && left.status === right.status
            && left.title === right.title && left.description === right.description && left.variant === right.variant
            && left.durationMs === right.durationMs && left.removalDelayMs === right.removalDelayMs
            && left.paused === right.paused && left.priority === right.priority && Object.is(left.data, right.data);
    }

    // endregion

    // region ----- Queue --------------------------------------------------------------------------------------------------
    const visibleIds: ToastId[] = [];
    const queuedIds: ToastId[] = [];

    function syncQueue(): void {
        queuedIds.sort(function (left, right) {
            const first = entries.get(left)!;
            const second = entries.get(right)!;
            return first.snapshot.priority - second.snapshot.priority || first.sequence - second.sequence;
        });

        while (visibleIds.length < configValues.maxVisible && queuedIds.length > 0) {
            const id = queuedIds.shift()!;
            const entry = entries.get(id)!;
            entry.snapshot.status = 'visible';
            visibleIds.push(id);
            syncExpiry(entry, true);
        }
    }

    function setMaxVisible(value: number): void {
        configValues.maxVisible = value;
        syncQueue();
        notify();
    }

    function clearQueue(): number {
        if (destroyed) return 0;
        const count = queuedIds.length;

        for (const id of [...queuedIds]) {
            removeEntry(entries.get(id)!);
        }

        notify();
        return count;
    }

    // endregion

    // region ----- Timing -------------------------------------------------------------------------------------------------
    function syncExpiry(entry: ToastEntry<T>, reset: boolean): void {
        if (entry.snapshot.status === 'dismissing') return;
        entry.remainingMs = reset ? entry.snapshot.durationMs : getRemainingDuration(entry);

        if (entry.snapshot.status !== 'visible' || entry.snapshot.durationMs === 0 || isPaused(entry)) {
            clearTimer(entry);
            return;
        }

        if (entry.remainingMs === 0) {
            hideEntry(entry);
            return;
        }

        if (!reset && entry.timer.kind === 'expiry') return;
        startTimer(getReference(entry), 'expiry', entry.remainingMs);
    }

    function getRemainingDuration(entry: ToastEntry<T>): number {
        return entry.timer.kind === 'expiry' && entry.timer.deadline !== null
            ? Math.max(0, entry.timer.deadline - globalThis.performance.now())
            : entry.remainingMs;
    }

    function startTimer(reference: ToastReference, kind: ToastTimerKind, delayMs: number, deadline?: number): void {
        const entry = entries.get(reference.id)!;
        clearTimer(entry);
        const now = globalThis.performance.now();
        entry.timer.kind = kind;
        entry.timer.deadline = deadline ?? now + delayMs;
        const revision = entry.timer.revision;
        entry.timer.handle = globalThis.setTimeout(function () {
            handleTimer(reference, revision, kind);
        }, Math.max(0, entry.timer.deadline - now));
    }

    function clearTimer(entry: ToastEntry<T>): void {
        if (entry.timer.handle !== null) {
            globalThis.clearTimeout(entry.timer.handle);
        }

        entry.timer.handle = null;
        entry.timer.deadline = null;
        entry.timer.kind = null;
        entry.timer.revision++;
    }

    function handleTimer(reference: ToastReference, revision: number, kind: ToastTimerKind): void {
        if (destroyed) return;
        const entry = entries.get(reference.id);

        if (!entry || entry.snapshot.generation !== reference.generation || entry.timer.revision !== revision
            || entry.timer.kind !== kind || entry.timer.deadline === null
            || (kind === 'expiry' ? entry.snapshot.status !== 'visible' || isPaused(entry) : entry.snapshot.status !== 'dismissing')) {
            return;
        }

        const remaining = entry.timer.deadline - globalThis.performance.now();

        if (remaining > 0) {
            startTimer(reference, kind, remaining, entry.timer.deadline);
            return;
        }

        if (kind === 'expiry') hideEntry(entry);
        else removeEntry(entry);

        syncQueue();
        notify();
    }

    // endregion

    // region ----- Pause and Resume ---------------------------------------------------------------------------------------
    const pauseReasons = new Set<string>();

    function isPaused(entry: ToastEntry<T>): boolean {
        return pauseReasons.size > 0 || entry.pauseReasons.size > 0;
    }

    function validatePauseReason(reason: string): void {
        if (typeof reason !== 'string' || reason.length === 0) {
            throw new TypeError(`Pause reason must be a non-empty string.`);
        }
    }

    function setToastPaused(target: ToastTarget, reason: string = 'manual'): boolean {
        if (destroyed) return false;
        validatePauseReason(reason);
        const entry = getEntry(target);

        if (!entry || entry.snapshot.status === 'dismissing' || entry.pauseReasons.has(reason)) {
            return false;
        }

        entry.pauseReasons.add(reason);
        entry.snapshot.paused = isPaused(entry);
        syncExpiry(entry, false);
        notify();
        return true;
    }

    function resumeToast(target: ToastTarget, reason: string = 'manual'): boolean {
        if (destroyed) return false;
        validatePauseReason(reason);
        const entry = getEntry(target);

        if (!entry || entry.snapshot.status === 'dismissing' || !entry.pauseReasons.delete(reason)) {
            return false;
        }

        entry.snapshot.paused = isPaused(entry);
        syncExpiry(entry, false);
        syncQueue();
        notify();
        return true;
    }

    function pause(reason: string = 'manual'): boolean {
        if (destroyed) return false;
        validatePauseReason(reason);
        if (pauseReasons.has(reason)) return false;
        pauseReasons.add(reason);

        for (const entry of entries.values()) {
            entry.snapshot.paused = isPaused(entry);
            syncExpiry(entry, false);
        }

        notify();
        return true;
    }

    function resume(reason: string = 'manual'): boolean {
        if (destroyed) return false;
        validatePauseReason(reason);
        if (!pauseReasons.delete(reason)) return false;

        for (const entry of Array.from(entries.values())) {
            entry.snapshot.paused = isPaused(entry);
            syncExpiry(entry, false);
        }

        syncQueue();
        notify();
        return true;
    }

    // endregion

    // region ----- Dismissal ----------------------------------------------------------------------------------------------
    function hideToast(target: ToastTarget): boolean {
        if (destroyed) return false;
        const entry = getEntry(target);

        if (!entry || entry.snapshot.status === 'dismissing') {
            return false;
        }

        hideEntry(entry);
        syncQueue();
        notify();
        return true;
    }

    function hideEntry(entry: ToastEntry<T>): void {
        entry.promiseToken = null;
        clearTimer(entry);

        if (entry.snapshot.status === 'queued' || entry.snapshot.removalDelayMs === 0) {
            removeEntry(entry);
            return;
        }

        entry.snapshot.status = 'dismissing';
        startTimer(getReference(entry), 'removal', entry.snapshot.removalDelayMs);
    }

    function removeToast(target: ToastTarget): boolean {
        if (destroyed) return false;
        const entry = getEntry(target);
        if (!entry) return false;
        removeEntry(entry);
        syncQueue();
        notify();
        return true;
    }

    function removeEntry(entry: ToastEntry<T>): void {
        clearTimer(entry);
        entry.promiseToken = null;
        const id = entry.snapshot.id;
        entries.delete(id);
        const visibleIndex = visibleIds.indexOf(id);
        const queuedIndex = queuedIds.indexOf(id);

        if (visibleIndex >= 0) {
            visibleIds.splice(visibleIndex, 1);
        }

        if (queuedIndex >= 0) {
            queuedIds.splice(queuedIndex, 1);
        }
    }

    function clearToasts(): number {
        if (destroyed) return 0;
        const count = entries.size;

        for (const entry of entries.values()) {
            clearTimer(entry);
            entry.promiseToken = null;
        }

        entries.clear();
        visibleIds.length = 0;
        queuedIds.length = 0;
        notify();
        return count;
    }

    // endregion

    // region ----- Promises -----------------------------------------------------------------------------------------------
    function createPromiseToast<TResult>(operation: PromiseLike<TResult> | (() => PromiseLike<TResult>), messages: ToastPromiseOptions<TResult, T>): ToastPromiseHandle<TResult> | null {
        if (destroyed) return null;
        validateToastRecord(messages);
        const loading = messages.loading;
        const id = getInputId(loading);
        const previous = id === undefined ? undefined : entries.get(id);
        const capturedLoading = getToastInput(loading, true);
        const success = getPromiseBranch(messages.success);
        const error = getPromiseBranch(messages.error);
        const factory = typeof operation === 'function' ? operation : null;
        const operationThen = typeof operation === 'function' ? null : operation?.then;

        if (!factory && typeof operationThen !== 'function') {
            throw new TypeError(`operation must be a promise-like value or a function returning one.`);
        }

        if (!isCurrentAdmission(id, previous)) return null;

        capturedLoading.variant = 'loading';
        const entry = previous ?? createEntry(id, capturedLoading);

        if (previous) {
            applyToastPatch(entry, capturedLoading);
        }

        const reference = getReference(entry);
        const token = Symbol();
        const durationMs = entry.ordinaryDurationMs;
        const priority = entry.snapshot.priority;

        // Admission commits ownership before callbacks; accepted factories always run.
        entry.promiseToken = token;
        syncQueue();
        notify();
        let promise: Promise<TResult>;

        try {
            promise = factory ? Promise.resolve(factory()) : new Promise<TResult>(function (resolve, reject) {
                Promise.resolve().then(function () {
                    Reflect.apply(operationThen!, operation, [resolve, reject]);
                }).catch(reject);
            });
        } catch (error) {
            promise = Promise.reject(error);
        }

        return {
            toast: {...reference},
            promise: promise.then(function (value) {
                settlePromise(reference, token, success, value, 'success', durationMs, priority);
                return value;
            }, function (reason: unknown) {
                settlePromise(reference, token, error, reason, 'error', durationMs, priority);
                throw reason;
            }),
        };
    }

    function getPromiseBranch<TResult>(branch: ToastContent<T> | ((value: TResult) => ToastContent<T>)): ToastContent<T> | ((value: TResult) => ToastContent<T>) {
        return typeof branch === 'function' ? branch : getToastInput(branch);
    }

    function settlePromise<TResult>(reference: ToastReference, token: symbol, branch: ToastContent<T> | ((value: TResult) => ToastContent<T>), value: TResult, variant: 'success' | 'error', durationMs: number, priority: number): void {
        if (!isCurrentPromise(reference, token)) return;

        try {
            const content = typeof branch === 'function' ? branch(value) : branch;
            if (!isCurrentPromise(reference, token)) return;
            const captured = getToastInput(content);
            if (!isCurrentPromise(reference, token)) return;
            const entry = entries.get(reference.id)!;
            const ordinaryDurationMs = captured.durationMs ?? durationMs;
            const nextVariant = captured.variant ?? variant;
            entry.snapshot = {
                ...entry.snapshot,
                title: captured.title ?? '',
                description: captured.description ?? '',
                data: captured.data,
                variant: nextVariant,
                durationMs: nextVariant === 'loading' ? 0 : ordinaryDurationMs,
                priority: captured.priority ?? priority,
            };
            entry.ordinaryDurationMs = ordinaryDurationMs;
            entry.promiseToken = null;
            syncExpiry(entry, true);
            syncQueue();
            notify();
        } catch (error) {
            if (!isCurrentPromise(reference, token)) return;
            reportError('promise-content-failed', 'A toast message could not be prepared.', {toast: {...reference}, error: error});

            if (isCurrentPromise(reference, token)) {
                removeToast(reference);
            }
        }
    }

    function isCurrentPromise(reference: ToastReference, token: symbol): boolean {
        if (destroyed) return false;
        const entry = entries.get(reference.id);
        return entry !== undefined && entry.snapshot.generation === reference.generation
            && entry.promiseToken === token && entry.snapshot.status !== 'dismissing';
    }

    // endregion

    // region ----- Destroy ------------------------------------------------------------------------------------------------
    function destroy(): void {
        if (destroyed) return;
        destroyed = true;
        notifier.destroy();
        cleanups.forEach(function (cleanup) {callConsumer(cleanup, undefined);});
        cleanups.length = 0;

        for (const entry of entries.values()) {
            clearTimer(entry);
            entry.promiseToken = null;
        }

        entries.clear();
        visibleIds.length = 0;
        queuedIds.length = 0;
        pauseReasons.clear();
        subscribers.clear();
        lastEmittedState = null;
    }

    // endregion

    init();

    return {
        config: reactiveConfig,
        getState: getState,
        subscribe: subscribe,
        createToast: createToast,
        updateToast: setToast,
        dismissToast: hideToast,
        removeToast: removeToast,
        pauseToast: setToastPaused,
        resumeToast: resumeToast,
        pause: pause,
        resume: resume,
        clearToasts: clearToasts,
        clearQueue: clearQueue,
        getToast: getToast,
        hasToast: hasToast,
        createPromiseToast: createPromiseToast,
        destroy: destroy,
    };
}

const configurationLayout = {
    maxVisible: {path: ["limits","maxVisible"]},
    durationMs: {path: ["timing","durationMs"]},
    removalDelayMs: {path: ["timing","removalDelayMs"]},
    onChange: {path: ["events","onChange"], optional: true},
    onError: {path: ["events","onError"], optional: true},
} as const;
