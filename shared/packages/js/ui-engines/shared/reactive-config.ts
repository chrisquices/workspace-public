import {createConfigUpdater} from 'workspace-packages/ui-engines/shared/config-updates';
import type {ConfigUpdate, ReactiveConfigController, ReactiveConfigOptions} from 'workspace-packages/ui-engines/shared/types';

export function createReactiveConfig<T extends object>(options: ReactiveConfigOptions<T>): ReactiveConfigController<T> {
    const views = new Map<string, object>();
    const sources = new WeakMap<object, readonly string[]>();
    const mutators = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift']);
    const keys = new Set([...Object.keys(options.values), ...Object.keys(options.read ?? {})]);
    const protections = new Map<Extract<keyof T, string>, () => void>();
    let destroyed = false;
    let revision = 0;
    const updates = createConfigUpdater<Extract<keyof T, string>>({
        validate: function (update) {
            update.previous = readValue(update.key);
            return options.validate(update);
        },
        apply: applyUpdate,
        getGroup: function (key) {return key;},
        reportFailure: function (update, error) {
            if (destroyed) return;

            if (options.reportFailure) options.reportFailure(update, error);
            else console.error('A reactive configuration update failed:', error);
        },
        cleanups: options.cleanups,
    });

    function syncProtection() {
        if (destroyed || options.canApply?.() === false) return;

        for (const name of Object.keys(options.blocked ?? {})) {
            if (destroyed || options.canApply?.() === false) return;
            const key = name as Extract<keyof T, string>;

            if (options.blocked![key]!()) {
                if (!protections.has(key)) {
                    protections.set(key, updates.protect(key));
                }
            } else {
                const release = protections.get(key);
                protections.delete(key);
                release?.();
            }
        }
    }

    function sync() {
        if (destroyed) return;
        revision++;
        syncProtection();
    }

    function getRevision() {
        return revision + updates.getRevision();
    }

    function applyUpdate(update: ConfigUpdate<Extract<keyof T, string>>) {
        if (destroyed || options.canApply?.() === false) return;
        revision++;
        const handler = options.apply && Object.hasOwn(options.apply, update.key) ? options.apply[update.key] : undefined;

        if (handler) {
            handler(update.value as T[typeof update.key], {...update, path: update.applyPath ?? update.path});
        } else if (!Object.is(options.values[update.key], update.value)) {
            Reflect.set(options.values, update.key, update.value);
            options.notify();
        }
    }

    function applyValueUpdate(key: string, value: unknown, path: readonly string[]) {
        if (destroyed || options.canApply?.() === false) return;
        syncProtection();
        if (destroyed || options.canApply?.() === false) return;
        const name = key as Extract<keyof T, string>;
        const pending = updates.getPending(name);
        const pendingPath = pending?.applyPath ?? pending?.path;
        let applyPath = path;

        if (pendingPath) {
            let length = 0;
            while (length < path.length && length < pendingPath.length && path[length] === pendingPath[length]) length++;
            applyPath = path.slice(0, length);
        }

        updates.apply({key: name, value: value, path: path, applyPath: applyPath});
        syncProtection();
    }

    function readValue(key: string): unknown {
        const name = key as Extract<keyof T, string>;
        const pending = updates.getPending(name);
        if (pending) return pending.value;
        const read = options.read && Object.hasOwn(options.read, name) ? options.read[name] : undefined;
        return read ? read() : Reflect.get(options.values, key);
    }

    function isContainer(value: unknown): value is Record<string, unknown> {
        if (!value || typeof value !== 'object') return false;
        const prototype = Object.getPrototypeOf(value);
        return Array.isArray(value) || prototype === Object.prototype || prototype === null;
    }

    function getValue(path: readonly string[]): unknown {
        let value: unknown = options.values;
        for (let index = 0; index < path.length; index++) {
            const key = path[index];
            if (!isContainer(value)) return undefined;
            value = index === 0 ? readValue(key) : Reflect.get(value, key);
        }
        return value;
    }

    function getCopy(value: unknown, seen = new WeakMap<object, object>(), path: readonly string[] = []): unknown {
        if (value && typeof value === 'object' && sources.has(value)) {
            value = getValue(sources.get(value)!);
        }

        if (options.isOpaque?.(value, path)) return value;
        value = options.snapshot ? options.snapshot(value, path) : value;
        if (!isContainer(value)) return value;
        const existing = seen.get(value);
        if (existing) return existing;
        const copy: Record<string, unknown> = Array.isArray(value) ? [] as unknown as Record<string, unknown> : Object.create(Object.getPrototypeOf(value));
        seen.set(value, copy);
        for (const key of Object.keys(value)) {
            Object.defineProperty(copy, key, {value: getCopy(value[key], seen, [...path, key]), enumerable: true, configurable: true, writable: true});
        }
        if (Array.isArray(value)) copy.length = value.length;
        return copy;
    }

    function applyValue(path: readonly string[], value: unknown, remove = false) {
        if (destroyed || options.canApply?.() === false) return;
        const revision = getRevision();
        const key = path[0];

        if (!key || !keys.has(key)) {
            throw new TypeError(`Unknown reactive configuration property '${key}'.`);
        }

        if (remove && (options.canDelete ? !options.canDelete(path) : path.length === 1)) {
            throw new TypeError(`Configuration '${path.join('.')}' cannot be deleted.`);
        }

        if (path.length === 1) {
            const next = getCopy(value, new WeakMap(), path);
            validateRevision(revision);
            applyValueUpdate(key, next, path);
            return;
        }

        const next = getCopy(getValue([key]), new WeakMap(), [key]);
        let parent = next;
        for (const name of path.slice(1, -1)) {
            if (!isContainer(parent)) {
                throw new TypeError(`The reactive configuration path is no longer available.`);
            }

            parent = Reflect.get(parent, name);
        }

        if (!isContainer(parent)) {
            throw new TypeError(`The reactive configuration path is no longer available.`);
        }

        if (remove) Reflect.deleteProperty(parent, path.at(-1)!);
        else if (Array.isArray(parent) && path.at(-1) === 'length') Reflect.set(parent, 'length', value);
        else Object.defineProperty(parent, path.at(-1)!, {value: getCopy(value, new WeakMap(), path), enumerable: true, configurable: true, writable: true});

        validateRevision(revision);
        applyValueUpdate(key, next, path);
    }

    function validateRevision(revision: number) {
        if (revision !== getRevision()) {
            throw new TypeError(`Configuration changed during the update.`);
        }
    }

    function createView(path: readonly string[], array: boolean): object {
        const id = `${array}:${path.map(function (key) {return `${key.length}:${key}`;}).join('')}`;
        const existing = views.get(id);
        if (existing) return existing;
        const target = array ? [] : {};
        const view: object = new Proxy(target, {
            get(_target, key) {
                const current = getValue(path);
                if (!isContainer(current)) return undefined;

                if (Array.isArray(current) && typeof key === 'string' && mutators.has(key)) {
                    return function (...args: unknown[]) {
                        const revision = getRevision();
                        const copy = getCopy(getValue(path), new WeakMap(), path);

                        if (!Array.isArray(copy)) {
                            throw new TypeError(`The reactive configuration array is no longer available.`);
                        }

                        const method = Reflect.get(Array.prototype, key);
                        const result = Reflect.apply(method, copy, args.map(function (argument, index) {return getCopy(argument, new WeakMap(), [...path, String(index)]);}));
                        validateRevision(revision);
                        applyValue(path, copy);
                        return result === copy ? view : result;
                    };
                }

                const value = path.length === 0 && typeof key === 'string' ? readValue(key) : Reflect.get(current, key);
                return typeof key === 'string' && isContainer(value) && !options.isOpaque?.(value, [...path, key])
                    ? createView([...path, key], Array.isArray(value))
                    : value;
            },
            set(_target, key, value) {
                if (typeof key !== 'string') {
                    throw new TypeError(`Reactive configuration keys must be strings.`);
                }

                applyValue([...path, key], value);
                return true;
            },
            deleteProperty(_target, key) {
                if (typeof key !== 'string') {
                    throw new TypeError(`Reactive configuration keys must be strings.`);
                }

                applyValue([...path, key], undefined, true);
                return true;
            },
            ownKeys() {
                if (!path.length) return Array.from(keys);
                const current = getValue(path);
                return isContainer(current) ? Reflect.ownKeys(current) : Reflect.ownKeys(target);
            },
            has(_target, key) {
                if (!path.length) {
                    return typeof key === 'string' && keys.has(key);
                }

                const current = getValue(path);
                return isContainer(current) && Reflect.has(current, key);
            },
            getOwnPropertyDescriptor(_target, key): PropertyDescriptor | undefined {
                const current = getValue(path);

                if (!isContainer(current) || !(path.length ? Object.hasOwn(current, key) : typeof key === 'string' && keys.has(key))) {
                    return Reflect.getOwnPropertyDescriptor(target, key);
                }

                return {configurable: key !== 'length' || !array, enumerable: key !== 'length' || !array, writable: true, value: Reflect.get(view, key)};
            },
            defineProperty() {
                throw new TypeError(`Assign reactive configuration properties directly.`);
            },
            setPrototypeOf() {
                throw new TypeError(`Reactive configuration prototypes cannot be changed.`);
            },
            preventExtensions() {
                throw new TypeError(`Reactive configuration objects cannot be frozen or sealed.`);
            },
        });
        views.set(id, view);
        sources.set(view, path);
        return view;
    }

    options.cleanups.push(function () {
        destroyed = true;
        revision++;
        protections.clear();
        views.clear();
    });

    return {config: createView([], false) as T, sync: sync};
}
