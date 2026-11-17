export type ToastId = string;

export type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'loading';

export type ToastStatus = 'queued' | 'visible' | 'dismissing';

/** Identifies one lifetime within its creating engine. Callbacks must retain both engine and reference. */
export type ToastReference = {
    id: ToastId;
    generation: number;
};

/** IDs target the current record; references reject callbacks from an earlier lifetime. */
export type ToastTarget = ToastId | ToastReference;

/** Plain content only. Consumers interpret opaque data for actions, icons, or custom presentation. */
export type ToastContent<T = unknown> = {
    title?: string;
    description?: string;
    variant?: ToastVariant;

    /** Finite milliseconds from 0 through 2147483647; 0 means persistent. Loading always resolves to 0. Explicit updates reset the countdown. */
    durationMs?: number;

    /** Finite number; lower values enter first. Equal priorities retain their original queue order. */
    priority?: number;

    /** Application-owned identity; never cloned, frozen, invoked, or observed by the engine. */
    data?: T;
};

export type ToastInput<T = unknown> = ToastContent<T> & {

    /** Non-empty string when supplied. Omit for an instance-generated ID. */
    id?: ToastId;
};

/** Omitted fields retain their latest values after input capture. Empty strings clear text; explicit data: undefined clears data. */
export type ToastPatch<T = unknown> = ToastContent<T>;

export type ToastSnapshot<T = unknown> = ToastReference & {
    status: ToastStatus;
    title: string;
    description: string;
    variant: ToastVariant;
    durationMs: number;

    /** Captured cleanup delay after dismissal. Removal is automatic even without a renderer. */
    removalDelayMs: number;

    /** Whether any engine-level or record-level reason currently suspends expiry. */
    paused: boolean;
    priority: number;
    data: T | undefined;
};

export type ToastState<T = unknown> = {
    config: ToastConfigSnapshot<T>;

    /** Admission order, including dismissing records until automatic or explicit removal. Independent of rendering. */
    visible: ToastSnapshot<T>[];

    /** Promotion order: ascending priority, then original enqueue sequence. */
    queued: ToastSnapshot<T>[];
    maxVisible: number;

    /** Whether engine-level pause reasons are active. Records may additionally be paused individually. */
    paused: boolean;
    destroyed: boolean;
};

export type ToastError = {
    id: string;
    message: string;
    metadata: unknown;
};

export type ToastConfigInputFields<T = unknown> = {

    /** Positive safe integer; defaults to 3. Counts visible + dismissing records; lowering it does not evict them. */
    maxVisible?: number;

    /** Defaults to 5000. Captured when a toast is created, not retroactively applied to existing records. */
    durationMs?: number;

    /** Finite milliseconds from 0 through 2147483647; defaults to 0 for immediate removal. Captured at creation. */
    removalDelayMs?: number;

    /** Receives the initial snapshot during construction and subsequent observable changes. */
    onChange?: (state: ToastState<T>) => void;
    onError?: (error: ToastError) => void;
};

export type ToastConfigFields<T = unknown> = Required<Omit<ToastConfigInputFields<T>, 'onChange' | 'onError'>> & {
    onChange: ToastConfigInputFields<T>['onChange'];
    onError: ToastConfigInputFields<T>['onError'];
};

export type ToastOptions<T = unknown> = {

    /** Inert optional anchor within the standard engine options shape. Pass null; rendering and lifecycle never depend on it. */
    element: HTMLElement | null;
    config: ToastConfig<T>;
};

/** Static fields and formatter identities are captured before admission; only opaque data retains caller ownership. */
export type ToastPromiseOptions<TResult, T = unknown> = {

    /** Creates/upserts a persistent loading toast, forcing variant 'loading'. Duration precedence: explicit value, existing ordinary duration, then creation default. */
    loading: ToastInput<T>;

    /** Replaces title/description/data; omitted values become empty strings/undefined. Variant defaults to success. Duration and priority fall back to admission values. */
    success: ToastContent<T> | ((value: TResult) => ToastContent<T>);

    /** Same replacement and fallback rules as success, with error as the default variant. */
    error: ToastContent<T> | ((reason: unknown) => ToastContent<T>);
};

export type ToastPromiseHandle<TResult> = {
    toast: ToastReference;

    /** Preserves the operation's value/rejection, including synchronous factory failures. */
    promise: Promise<TResult>;
};

/** Headless toast state and lifecycle actions. The owner destroys the engine when finished. */
export type ToastEngine<T = unknown> = {
    readonly config: ToastReactiveConfig<T>;
    getState: () => ToastState<T>;

    /** Change-only delivery; read getState() for the initial value. Returns idempotent unsubscribe. */
    subscribe: (listener: (state: ToastState<T>) => void) => () => void;

    /** Existing queued/visible IDs update in place; dismissing IDs and destroyed instances return null. */
    createToast: (input: ToastInput<T>) => ToastReference | null;

    /** Patches queued/visible records. Explicit duration resets timing; text/data/priority alone preserve it. Accepted resets or promise invalidation return true. */
    updateToast: (target: ToastTarget, patch: ToastPatch<T>) => boolean;

    /** Removes queued records immediately. Visible records are removed now or after their captured removal delay. Repeated calls return false. */
    dismissToast: (target: ToastTarget) => boolean;

    /** Immediate removal from any lifecycle state, optionally shortening a pending cleanup delay. */
    removeToast: (target: ToastTarget) => boolean;

    /** Adds a non-empty reason (default 'manual') at record scope. Repeated reasons are idempotent. */
    pauseToast: (target: ToastTarget, reason?: string) => boolean;

    /** Clears only this record's matching reason. Expiry resumes only after all applicable reasons clear. */
    resumeToast: (target: ToastTarget, reason?: string) => boolean;

    /** Pauses expiry for current and future records. Independent callers must use distinct reason keys. */
    pause: (reason?: string) => boolean;

    /** Clears only the matching engine-level reason; record-level reasons remain intact. */
    resume: (reason?: string) => boolean;

    /** Immediately clears visible and queued records atomically; returns the number removed. */
    clearToasts: () => number;

    /** Removes only waiting records; returns the number removed. */
    clearQueue: () => number;
    getToast: (target: ToastTarget) => ToastSnapshot<T> | null;
    hasToast: (target: ToastTarget) => boolean;

    /** Invalid input throws; destroyed/dismissing/stale admission returns null without invoking a factory. Once admitted, invokes it exactly once and returns a handle despite later teardown. */
    createPromiseToast: <TResult>(operation: PromiseLike<TResult> | (() => PromiseLike<TResult>), messages: ToastPromiseOptions<TResult, T>) => ToastPromiseHandle<TResult> | null;
    destroy: () => void;
};

/** Private lifecycle timer; expiry and delayed removal are mutually exclusive. */
export type ToastTimerKind = 'expiry' | 'removal';

export type ToastTimer = {
    handle: ReturnType<typeof globalThis.setTimeout> | null;
    kind: ToastTimerKind | null;
    revision: number;

    /** Monotonic deadline in the engine's runtime, never wall-clock time. */
    deadline: number | null;
};

/** Private mutable record. No historical tombstones are retained after removal. */
export type ToastEntry<T = unknown> = {
    snapshot: ToastSnapshot<T>;

    /** Captured requested/default duration; retained while the loading snapshot exposes duration 0. */
    ordinaryDurationMs: number;

    /** Remaining finite expiry budget while unscheduled. Zero means exhausted, not persistent. */
    remainingMs: number;
    pauseReasons: Set<string>;
    timer: ToastTimer;
    sequence: number;
    promiseToken: symbol | null;
};

export type ToastConfig<T = unknown> = {
    limits?: {
        maxVisible?: ToastConfigInputFields<T>['maxVisible'];
    };
    timing?: {
        durationMs?: ToastConfigInputFields<T>['durationMs'];
        removalDelayMs?: ToastConfigInputFields<T>['removalDelayMs'];
    };
    events?: {
        onChange?: ToastConfigInputFields<T>['onChange'];
        onError?: ToastConfigInputFields<T>['onError'];
    };
};

export interface ToastReactiveConfigLimits<T = unknown> {
    maxVisible: ToastConfigFields<T>['maxVisible'];
}

export interface ToastReactiveConfigTiming<T = unknown> {
    durationMs: ToastConfigFields<T>['durationMs'];
    removalDelayMs: ToastConfigFields<T>['removalDelayMs'];
}

export interface ToastReactiveConfigEvents<T = unknown> {
    onChange?: ToastConfigFields<T>['onChange'];
    onError?: ToastConfigFields<T>['onError'];
}

export interface ToastReactiveConfig<T = unknown> {
    get limits(): ToastReactiveConfigLimits<T>;
    set limits(value: {
        maxVisible?: ToastConfigInputFields<T>['maxVisible'];
    });
    get timing(): ToastReactiveConfigTiming<T>;
    set timing(value: {
        durationMs?: ToastConfigInputFields<T>['durationMs'];
        removalDelayMs?: ToastConfigInputFields<T>['removalDelayMs'];
    });
    get events(): ToastReactiveConfigEvents<T>;
    set events(value: {
        onChange?: ToastConfigInputFields<T>['onChange'];
        onError?: ToastConfigInputFields<T>['onError'];
    });
}

export type ToastConfigSnapshot<T = unknown> = Readonly<Omit<ToastReactiveConfig<T>, 'events' | 'document' | 'source' | 'src' | 'sources'>>;
