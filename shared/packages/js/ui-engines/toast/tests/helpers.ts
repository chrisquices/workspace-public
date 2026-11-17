import { createToaster } from 'workspace-packages/ui-engines/toast';
import type { TestContext } from 'node:test';
import type { ToastConfig, ToastState, ToastError } from 'workspace-packages/ui-engines/toast';
export function createClock(t: TestContext) {
    let now = 0;
    let nextId = 0;
    const timers = new Map<number, {
        callback: () => void;
        deadline: number;
    }>();
    const callbacks = new Map<number, () => void>();
    t.mock.method(globalThis.performance, 'now', () => now);
    t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
        const id = ++nextId;
        timers.set(id, { callback, deadline: now + delay });
        callbacks.set(id, callback);
        return id;
    });
    t.mock.method(globalThis, 'clearTimeout', (id: number) => timers.delete(id));
    function fire(id: number) {
        timers.delete(id);
        callbacks.get(id)!();
    }
    function advance(milliseconds: number) {
        const end = now + milliseconds;
        while (true) {
            const next = [...timers].sort((left, right) => left[1].deadline - right[1].deadline)[0];
            if (!next || next[1].deadline > end)
                break;
            now = Math.max(now, next[1].deadline);
            fire(next[0]);
        }
        now = end;
    }
    return {
        advance,
        elapse(milliseconds: number) { now += milliseconds; },
        fire,
        get now() { return now; },
        pending() { return [...timers].map(([id, timer]) => ({ id, deadline: timer.deadline })); },
    };
}
export function createFixture(t: TestContext, config: ToastConfig = {}) {
    const clock = createClock(t);
    const changes: ToastState[] = [];
    const errors: ToastError[] = [];
    const engine = createToaster({
        element: null,
        config: {
            ...config,
            events: { onChange: state => changes.push(state), onError: error => errors.push(error), ...config.events }
        },
    });
    t.after(() => engine.destroy());
    return { engine, clock, changes, errors };
}
export function getIds(state: ToastState) {
    return { visible: state.visible.map(toast => toast.id), queued: state.queued.map(toast => toast.id) };
}
