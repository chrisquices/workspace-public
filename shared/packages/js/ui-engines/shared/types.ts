export interface ReactiveConfigOptions<T extends object> {
    values: Partial<T>;
    validate: (update: ConfigUpdate<Extract<keyof T, string>>) => boolean | void;
    canApply?: () => boolean;
    canDelete?: (path: readonly string[]) => boolean;
    read?: {[K in keyof T]?: () => T[K]};
    apply?: {[K in keyof T]?: (value: T[K], update: ConfigUpdate<Extract<keyof T, string>>) => unknown};
    blocked?: {[K in keyof T]?: () => boolean};
    snapshot?: (value: unknown, path: readonly string[]) => unknown;
    isOpaque?: (value: unknown, path: readonly string[]) => boolean;
    notify: () => void;
    reportFailure?: (update: ConfigUpdate<Extract<keyof T, string>>, error: unknown) => void;
    cleanups: Array<() => void>;
}

export interface ReactiveConfigController<T extends object> {
    readonly config: T;
    sync(): void;
}

export interface ConfigUpdate<TKey extends string = string> {
    key: TKey;
    value: unknown;
    path: readonly string[];
    previous?: unknown;

    /** Common ancestor of queued writes; application handlers receive it without changing the validation path. */
    applyPath?: readonly string[];

    /** Complete candidate field values for validating a settings-group update before any side effects. */
    values?: Partial<Record<TKey, unknown>>;

    /** Only explicitly requested fields or members, retained while an engine update is deferred. */
    patches?: ConfigPatch[];
}

export interface ConfigPatch {
    key: string;
    path: readonly string[];
    value: unknown;
}

export interface ConfigTransaction {
    key: string;
    path: readonly string[];
    patches: ConfigPatch[];
}

export interface ConfigField {
    path: readonly string[];
    optional?: boolean;
    inverted?: boolean;
    readonly?: boolean;
    keys?: readonly string[];
    optionalKeys?: readonly string[];
    defaults?: Readonly<Record<string, unknown>>;
}

export type ConfigLayout = Readonly<Record<string, ConfigField>>;

export interface EngineConfigOptions<T extends object> extends ReactiveConfigOptions<T> {
    layout: ConfigLayout;
    excludeSnapshot?: readonly string[];
    applyOrder?: readonly Extract<keyof T, string>[];
    applyTogether?: readonly (readonly Extract<keyof T, string>[])[];
}

export interface EngineConfigController<T extends object> extends ReactiveConfigController<T> {
    getSnapshot(): Readonly<Omit<T, 'events'>>;
    hasChanges(): boolean;
    isApplying(): boolean;
}

export interface ConfigUpdaterOptions<TKey extends string = string> {
    validate: (update: ConfigUpdate<TKey>) => boolean | void;
    apply: (update: ConfigUpdate<TKey>) => void;
    getGroup?: (key: TKey) => string | undefined;
    reportFailure: (update: ConfigUpdate<TKey>, error: unknown) => void;
    cleanups: Array<() => void>;
}
