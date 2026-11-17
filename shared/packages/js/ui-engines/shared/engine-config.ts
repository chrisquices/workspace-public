import {createReactiveConfig} from 'workspace-packages/ui-engines/shared/reactive-config';
import type {ConfigField, ConfigLayout, ConfigPatch, ConfigTransaction, ConfigUpdate, EngineConfigController, EngineConfigOptions} from 'workspace-packages/ui-engines/shared/types';

/** Capture only the declared public shape; internal field names are never accepted as aliases. */
export function captureEngineConfig<T extends object>(input: T, layout: ConfigLayout, defaults: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {}): T {
    function capture(value: unknown, path: string[]): unknown {
        const match = Object.entries(layout).find(function (entry) {return entry[1].path.join('.') === path.join('.');});
        const field = match?.[1];

        if (field) {
            if (field.keys && isSettingsObject(value)) {
                validateKeys(value, field.keys, path);
                const copy = copyConfigValue(value) as Record<string, unknown>;
                for (const [key, fallback] of Object.entries(defaults[match![0]] ?? field.defaults ?? {})) {
                    if (copy[key] === undefined) copy[key] = fallback;
                }
                return copy;
            }

            return value;
        }

        validateKeys(value, Object.values(layout).filter(function (entry) {
            return path.every(function (key, index) {return entry.path[index] === key;});
        }).map(function (entry) {return entry.path[path.length];}), path);
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value as object)) {
            const child = (value as Record<string, unknown>)[key];
            result[key] = child === undefined ? undefined : capture(child, [...path, key]);
        }
        return result;
    }
    return capture(input, []) as T;
}

/** Bind the public settings tree to engine-owned fields and their domain update handlers. */
export function createEngineConfig<TFields extends object, TConfig extends object>(options: EngineConfigOptions<TFields>): EngineConfigController<TConfig> {
    const entries = Object.entries(options.layout) as Array<[Extract<keyof TFields, string>, ConfigField]>;
    const topKeys = [...new Set(entries.map(function (entry) {return entry[1].path[0];}))];
    const values = Object.fromEntries(topKeys.map(function (key) {return [key, undefined];}));
    const read: Record<string, () => unknown> = {};
    const apply: Record<string, (value: unknown, update: ConfigUpdate<string>) => void> = {};
    const pending: ConfigTransaction[] = [];
    let syncing = false;
    let applying = 0;
    let snapshot: Record<string, unknown> | undefined;
    let notifiedSnapshot: unknown;

    function getField(key: Extract<keyof TFields, string>, entry: ConfigField): unknown {
        const reader = options.read?.[key];
        const value = reader ? reader() : options.values[key];
        return entry.inverted ? !value : value;
    }

    function getTree(includePending = false): Record<string, unknown> {
        const tree: Record<string, unknown> = {};
        for (const [key, entry] of entries) {
            let parent = tree;
            for (const part of entry.path.slice(0, -1)) {
                parent = (parent[part] ??= {}) as Record<string, unknown>;
            }
            parent[entry.path.at(-1)!] = getField(key, entry);
        }

        if (includePending) {
            for (const transaction of pending) applyPatches(tree, transaction.patches);
        }

        return tree;
    }

    function getPath(value: unknown, path: readonly string[]): unknown {
        for (const key of path) {
            if (!value || typeof value !== 'object') return undefined;
            value = (value as Record<string, unknown>)[key];
        }
        return value;
    }

    function merge(current: unknown, patch: unknown, path: string[], mutationPath: readonly string[]): unknown {
        const entry = entries.find(function (entry) {return entry[1].path.join('.') === path.join('.');})?.[1];

        if (patch === undefined) {
            return entry?.optional ? undefined : current;
        }

        if (entry && !entry.keys) return patch;

        if (entry && (!isSettingsObject(patch) || !isSettingsObject(current))) {
            if (isSettingsObject(patch)) {
                validateKeys(patch, entry.keys!, path);
                const result = {...patch};
                for (const [key, fallback] of Object.entries(entry.defaults ?? {})) {
                    if (result[key] === undefined) result[key] = fallback;
                }
                return result;
            }

            return patch;
        }

        const keys = entry?.keys ?? Object.keys(current as object);
        validateKeys(patch, keys, path);
        const result: Record<string, unknown> = {};
        for (const key of keys) {
            const childPath = [...path, key];
            const owns = Object.hasOwn(patch as object, key);

            if (!owns && mutationPath.join('.') === childPath.join('.')) {
                const child = entries.find(function (entry) {return entry[1].path.join('.') === childPath.join('.');})?.[1];

                if (!(entry ? entry.optionalKeys?.includes(key) : child?.optional)) {
                    throw new TypeError(`Configuration '${childPath.join('.')}' cannot be deleted.`);
                }

                result[key] = undefined;
            } else if (owns) {
                result[key] = entry ? (patch as Record<string, unknown>)[key] === undefined && !entry.optionalKeys?.includes(key) ? (current as Record<string, unknown>)[key] : (patch as Record<string, unknown>)[key]
                    : merge((current as Record<string, unknown>)[key], (patch as Record<string, unknown>)[key], childPath, mutationPath);
            } else if (Object.hasOwn(current as object, key)) {
                result[key] = (current as Record<string, unknown>)[key];
            }
        }
        return result;
    }

    function setPath(tree: Record<string, unknown>, path: readonly string[], value: unknown): void {
        let parent = tree;
        for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
        parent[path.at(-1)!] = value;
    }

    function getPatches(update: ConfigUpdate<string>): ConfigPatch[] {
        const patches: ConfigPatch[] = [];
        for (const [key, field] of entries) {
            if (field.path[0] !== update.key) continue;
            const ancestor = update.path.every(function (part, index) {return field.path[index] === part;});
            const descendant = field.path.every(function (part, index) {return update.path[index] === part;});
            if (!ancestor && !descendant) continue;
            let value = update.value;
            let present = true;
            for (const part of field.path.slice(1)) {
                if (!isSettingsObject(value) || !Object.hasOwn(value, part)) {present = false; value = undefined; break;}
                value = value[part];
            }
            if (!present && !descendant) continue;

            if (field.keys && isSettingsObject(value)) {
                if (ancestor && !isSettingsObject(getPath(update.previous, field.path.slice(1)))) {
                    patches.push({key: key, path: field.path, value: value});
                    continue;
                }

                const member = descendant ? update.path[field.path.length] : undefined;
                const names = member ? [member] : Object.keys(value);
                for (const name of names) {
                    const next = value[name];

                    if (next === undefined && !field.optionalKeys?.includes(name)) {
                        continue;
                    }

                    patches.push({key: key, path: [...field.path, name], value: next});
                }
            } else if (value !== undefined || field.optional) {
                patches.push({key: key, path: field.path, value: value});
            }
        }
        return patches;
    }

    function applyPatches(tree: Record<string, unknown>, patches: readonly ConfigPatch[]): void {
        for (const patch of patches) {
            const field = options.layout[patch.key];
            const current = getPath(tree, field.path);
            const member = patch.path[field.path.length];
            const value = member === undefined ? patch.value : {[member]: patch.value};
            setPath(tree, field.path, merge(current, value, [...field.path], patch.path));
        }
    }

    function prepare(transaction: ConfigTransaction, includePending = false): Array<ConfigUpdate<Extract<keyof TFields, string>>> | false {
        const previous = getTree(includePending);
        const tree = getTree(includePending);
        applyPatches(tree, transaction.patches);
        const candidate: Partial<Record<Extract<keyof TFields, string>, unknown>> = {};
        const changes: Array<ConfigUpdate<Extract<keyof TFields, string>>> = [];
        const touched = new Set(transaction.patches.map(function (patch) {return patch.key;}));
        for (const [key, field] of entries) {
            const value = getPath(tree, field.path);

            if (field.inverted && typeof value !== 'boolean') {
                throw new TypeError(`Configuration '${field.path.join('.')}' must be a boolean.`);
            }

            candidate[key] = field.inverted ? !value : value;
        }
        for (const [key, field] of entries) {
            if (!touched.has(key)) continue;
            const value = candidate[key];
            const before = getPath(previous, field.path);

            if (sameConfigValue(field.inverted ? !before : before, value, [key], options.isOpaque)) {
                continue;
            }

            if (field.readonly) {
                throw new TypeError(`Configuration '${field.path.join('.')}' is construction-only.`);
            }

            changes.push({key: key, value: value, path: [key], values: candidate});
        }
        for (const change of changes) {
            if (options.validate(change) === false || options.canApply?.() === false) {
                return false;
            }

            candidate[change.key] = change.value;
            const field = options.layout[change.key];
            for (const patch of transaction.patches) {
                if (patch.key !== change.key) continue;
                const member = patch.path[field.path.length];
                patch.value = member === undefined ? field.inverted ? !change.value : change.value : (change.value as Record<string, unknown>)[member];
            }
        }
        return changes;
    }

    function validate(update: ConfigUpdate<string>): boolean {
        if (options.canApply?.() === false) return false;

        // Validate the supplied shape before reducing it to the explicitly written fields.
        merge(update.previous, update.value, [update.key], update.path);
        update.patches = getPatches(update);
        return prepare({key: update.key, path: update.path, patches: update.patches}, true) !== false;
    }

    function applyChanges(changes: Array<ConfigUpdate<Extract<keyof TFields, string>>>): void {
        if (!changes.length || options.canApply?.() === false) {
            return;
        }

        if (options.applyOrder) {
            changes.sort(function (left, right) {return options.applyOrder!.indexOf(left.key) - options.applyOrder!.indexOf(right.key);});
        }

        applying++;
        try {

            // Domain validation for the entire transaction has completed before any field is committed.
            for (const change of changes) {
                if (!options.apply?.[change.key]) {
                    Reflect.set(options.values, change.key, change.value);
                }
            }
            for (const change of changes) {
                if (options.canApply?.() === false) return;
                const handler = options.apply?.[change.key];

                if (handler) {
                    handler(change.value as TFields[typeof change.key], change);
                }
            }
        } finally {
            applying--;

            if (!applying && options.canApply?.() !== false) {
                options.notify();
            }
        }
    }

    function isBlocked(changes: Array<ConfigUpdate<Extract<keyof TFields, string>>>): boolean {
        return changes.some(function (change) {return options.blocked?.[change.key]?.();});
    }

    function applyGroup(_value: unknown, update: ConfigUpdate<string>): void {
        if (options.canApply?.() === false) return;
        const patches = update.patches ?? [];
        const keys = new Set(patches.map(function (patch) {return patch.key;}));
        for (const group of options.applyTogether ?? []) {
            if (group.some(function (key) {return keys.has(key);})) {
                for (const key of group) keys.add(key);
            }
        }
        let related = pending.filter(function (transaction) {return transaction.patches.some(function (patch) {return keys.has(patch.key);});});
        let transaction = {key: update.key, path: update.path, patches: [...related.flatMap(function (item) {return item.patches;}), ...patches].map(function (patch) {return {...patch};})};
        let changes;
        try {
            changes = prepare(transaction);
        } catch (error) {

            // A new constraint can depend on another deferred write in the same settings group.
            related = pending.filter(function (item) {return item.key === update.key;});
            if (!related.length) throw error;
            transaction = {key: update.key, path: update.path, patches: [...related.flatMap(function (item) {return item.patches;}), ...patches].map(function (patch) {return {...patch};})};
            changes = prepare(transaction);
        }
        if (changes === false) return;
        for (const item of related) pending.splice(pending.indexOf(item), 1);

        if (isBlocked(changes)) pending.push(transaction);
        else applyChanges(changes);

        sync();
    }

    function sync(): void {
        if (syncing || applying || options.canApply?.() === false) {
            return;
        }

        syncing = true;
        try {
            let progressed;
            do {
                progressed = false;
                for (const transaction of [...pending]) {
                    if (options.canApply?.() === false) return;
                    if (!pending.includes(transaction)) continue;
                    try {
                        const changes = prepare(transaction);
                        if (changes === false || isBlocked(changes)) continue;
                        pending.splice(pending.indexOf(transaction), 1);
                        progressed = true;
                        applyChanges(changes);
                    } catch (error) {
                        const index = pending.indexOf(transaction);
                        if (index >= 0) pending.splice(index, 1);
                        const key = transaction.patches[0]?.key as Extract<keyof TFields, string>;

                        if (key && options.canApply?.() !== false) {
                            options.reportFailure?.({key: key, value: transaction.patches[0].value, path: transaction.path}, error);
                        }
                    }
                }
            } while (progressed && pending.length);
        } finally {
            syncing = false;
            controller.sync();
        }
    }

    for (const key of topKeys) {
        read[key] = function () {return getTree(true)[key];};
        apply[key] = applyGroup;
    }

    options.cleanups.push(function () {
        pending.length = 0;
        snapshot = undefined;
        notifiedSnapshot = undefined;
    });

    function getFieldPath(path: readonly string[]): readonly string[] {
        const entry = entries.find(function (entry) {return entry[1].path.every(function (key, index) {return path[index] === key;});});
        return entry ? [entry[0], ...path.slice(entry[1].path.length)] : path;
    }

    function canDelete(path: readonly string[]): boolean {
        const match = entries.find(function (entry) {return entry[1].path.every(function (key, index) {return path[index] === key;});});
        if (!match) return false;
        const field = match[1];
        if (field.readonly) return false;

        if (path.length === field.path.length) {
            return field.optional === true;
        }

        if (!field.keys) return true;
        const key = path[field.path.length];
        return field.keys.includes(key) && (path.length > field.path.length + 1 || field.optionalKeys?.includes(key) === true);
    }

    const controller = createReactiveConfig<Record<string, unknown>>({
        values: values,
        read: read,
        apply: apply,
        validate: validate,
        canApply: options.canApply,
        canDelete: canDelete,
        snapshot: function (value, path) {return options.snapshot ? options.snapshot(value, getFieldPath(path)) : value;},
        isOpaque: function (value, path) {return options.isOpaque?.(value, getFieldPath(path)) ?? false;},
        notify: options.notify,
        reportFailure: function (update, error) {
            const key = entries.find(function (entry) {return entry[1].path[0] === update.key;})![0];

            if (options.reportFailure) {
                options.reportFailure({key: key, value: update.value, path: update.path}, error);
            }
        },
        cleanups: options.cleanups,
    });

    function getSnapshot(): Readonly<Omit<TConfig, 'events'>> {
        const tree = getTree();
        for (const key of ['events', 'document', ...(options.excludeSnapshot ?? [])]) delete tree[key];

        if (!snapshot || !sameConfigValue(tree, snapshot, [], isSnapshotOpaque)) {
            snapshot = copyConfigValue(tree, true, new WeakMap(), [], isSnapshotOpaque) as Record<string, unknown>;
        }

        return snapshot as Readonly<Omit<TConfig, 'events'>>;
    }

    function isSnapshotOpaque(value: unknown, path: readonly string[]): boolean {
        return options.isOpaque?.(value, getFieldPath(path)) ?? false;
    }

    function hasChanges(): boolean {
        const current = getSnapshot();
        const changed = current !== notifiedSnapshot;
        notifiedSnapshot = current;
        return changed;
    }

    function isApplying(): boolean {
        return applying > 0;
    }

    return {config: controller.config as TConfig, sync: sync, getSnapshot: getSnapshot, hasChanges: hasChanges, isApplying: isApplying};
}

function validateKeys(value: unknown, keys: readonly string[], path: readonly string[]): void {
    if (!isSettingsObject(value)) {
        throw new TypeError(`Configuration '${path.join('.') || 'config'}' must be a settings object.`);
    }

    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !keys.includes(key)) {
            throw new TypeError(`Unknown configuration property '${[...path, String(key)].join('.')}'.`);
        }
    }
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function copyConfigValue(value: unknown, freeze = false, seen = new WeakMap<object, unknown>(), path: readonly string[] = [], isOpaque?: (value: unknown, path: readonly string[]) => boolean): unknown {
    // Application-owned values retain their identity; only engine-owned settings are copied and frozen.
    if (isOpaque?.(value, path)) return value;

    if (!value || typeof value !== 'object' || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
        return value;
    }

    if (seen.has(value)) return seen.get(value);
    const copy: Record<string, unknown> = Array.isArray(value) ? [] as unknown as Record<string, unknown> : Object.create(Object.getPrototypeOf(value));
    seen.set(value, copy);
    for (const key of Object.keys(value)) Object.defineProperty(copy, key, {value: copyConfigValue((value as Record<string, unknown>)[key], freeze, seen, [...path, key], isOpaque), enumerable: true, configurable: true, writable: true});
    if (Array.isArray(value)) copy.length = value.length;
    return freeze ? Object.freeze(copy) : copy;
}

function sameConfigValue(left: unknown, right: unknown, path: readonly string[] = [], isOpaque?: (value: unknown, path: readonly string[]) => boolean, seen = new WeakMap<object, object>()): boolean {
    if (Object.is(left, right)) return true;

    if (isOpaque?.(left, path) || isOpaque?.(right, path)) {
        return false;
    }

    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
        return false;
    }

    if (Array.isArray(left) !== Array.isArray(right) || Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
        return false;
    }

    if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) {
        return false;
    }

    if (!Array.isArray(left) && ![Object.prototype, null].includes(Object.getPrototypeOf(left))) {
        return false;
    }

    if (seen.get(left) === right) return true;
    seen.set(left, right);
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(function (key) {
        return Object.hasOwn(right, key) && sameConfigValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], [...path, key], isOpaque, seen);
    });
}
