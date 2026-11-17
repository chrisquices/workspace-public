import type {ConfigUpdate, ConfigUpdaterOptions} from 'workspace-packages/ui-engines/shared/types';

export function createConfigUpdater<TKey extends string>(options: ConfigUpdaterOptions<TKey>) {
    const protectedGroups = new Map<string, number>();
    const pending = new Map<TKey, ConfigUpdate<TKey>>();
    const requests = new Map<TKey, number>();
    let destroyed = false;
    let revision = 0;

    function apply(update: ConfigUpdate<TKey>) {
        if (destroyed) return;
        const request = ++revision;
        requests.set(update.key, request);
        const valid = options.validate(update);

        if (valid === false || destroyed || requests.get(update.key) !== request) {
            return;
        }

        const group = options.getGroup?.(update.key);

        if (group !== undefined && protectedGroups.has(group)) {
            pending.set(update.key, update);
            return;
        }

        pending.delete(update.key);
        options.apply(update);
    }

    function protect(group: string) {
        if (destroyed) return function release() {};
        protectedGroups.set(group, (protectedGroups.get(group) ?? 0) + 1);
        let released = false;

        return function release() {
            if (released || destroyed) return;
            released = true;
            const remaining = protectedGroups.get(group)! - 1;

            if (remaining > 0) {
                protectedGroups.set(group, remaining);
                return;
            }

            protectedGroups.delete(group);

            for (const [key, update] of Array.from(pending)) {
                if (destroyed || protectedGroups.has(group)) return;
                if (pending.get(key) !== update) continue;
                if (options.getGroup?.(key) !== group) continue;
                pending.delete(key);

                try {
                    apply(update);
                } catch (error) {
                    options.reportFailure(update, error);
                }
            }
        };
    }

    function getPending(key: TKey) {
        return pending.get(key);
    }

    function getRevision() {
        return revision;
    }

    function destroy() {
        destroyed = true;
        revision++;
        pending.clear();
        protectedGroups.clear();
        requests.clear();
    }

    options.cleanups.push(destroy);

    return {
        apply: apply,
        protect: protect,
        getPending: getPending,
        getRevision: getRevision,
        destroy: destroy,
    };
}
