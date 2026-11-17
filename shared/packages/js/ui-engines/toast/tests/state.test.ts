import { setConfigPath } from '../../shared/tests/config-path.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToaster } from 'workspace-packages/ui-engines/toast';
import { createClock, createFixture, getIds } from './helpers.ts';
test('initializes a complete empty snapshot without requiring a host or renderer', function (t) {
    const { engine, changes, clock } = createFixture(t);
    assert.deepEqual(changes, [{ config: engine.getState().config, visible: [], queued: [], maxVisible: 3, paused: false, destroyed: false }]);
    assert.deepEqual(engine.getState(), changes[0]);
    assert.deepEqual(clock.pending(), []);
    assert.deepEqual(Object.keys(engine), [
        'config', 'getState', 'subscribe', 'createToast', 'updateToast', 'dismissToast', 'removeToast',
        'pauseToast', 'resumeToast', 'pause', 'resume', 'clearToasts', 'clearQueue', 'getToast', 'hasToast',
        'createPromiseToast', 'destroy',
    ]);
});
test('validates construction and reactive config before mutation while keeping the host inert', function (t) {
    const clock = createClock(t);
    for (const options of [null, [], 1, { element: {} }, { element: null, config: null }, { element: null, config: [] }]) {
        assert.throws(() => createToaster(options), TypeError);
    }
    for (const invalid of [
        { limits: {
                maxVisible: 0
            } }, { limits: {
                maxVisible: 1.5
            } }, { limits: {
                maxVisible: Number.MAX_SAFE_INTEGER + 1
            } },
        { timing: {
                durationMs: -1
            } }, { timing: {
                durationMs: Infinity
            } }, { timing: {
                durationMs: 2 ** 31
            } }, { timing: {
                durationMs: '1'
            } },
        { timing: {
                removalDelayMs: -1
            } }, { timing: {
                removalDelayMs: NaN
            } }, { timing: {
                removalDelayMs: 2 ** 31
            } },
        { events: {
                onChange: null
            } }, { events: {
                onError: true
            } },
    ]) {
        assert.throws(() => createToaster({ element: null, config: invalid }), TypeError);
    }
    const host = {
        nodeType: 1,
        ownerDocument: { get defaultView() { throw new Error('The host must not choose the runtime'); } },
        addEventListener() { throw new Error('No listeners belong on the host'); },
    };
    const engine = createToaster({ element: host, config: {} });
    t.after(() => engine.destroy());
    const reference = engine.createToast({});
    const before = engine.getState();
    for (const [key, value] of [
        ["limits.maxVisible", 0], ["timing.durationMs", NaN], ["timing.removalDelayMs", Infinity], ["events.onChange", 1], ["events.onError", 'invalid'],
    ]) {
        assert.throws(() => { setConfigPath(engine.config, key, value); }, TypeError);
    }
    assert.deepEqual(engine.getState(), before);
    clock.advance(5000);
    assert.equal(engine.hasToast(reference!), false);
});
test('captures new-record defaults while preserving existing visible and queued settings', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 100, removalDelayMs: 10
        } });
    engine.createToast({ id: 'first' });
    engine.createToast({ id: 'queued' });
    const count = changes.length;
    engine.config.timing.durationMs = 20;
    engine.config.timing.removalDelayMs = 30;
    assert.equal(changes.length, count + 2);
    engine.createToast({ id: 'new' });
    assert.equal(engine.getToast('first')!.durationMs, 100);
    assert.equal(engine.getToast('queued')!.durationMs, 100);
    assert.equal(engine.getToast('queued')!.removalDelayMs, 10);
    assert.equal(engine.getToast('new')!.durationMs, 20);
    assert.equal(engine.getToast('new')!.removalDelayMs, 30);
    engine.removeToast('first');
    clock.advance(100);
    assert.equal(engine.getToast('queued')!.status, 'dismissing');
    clock.advance(10);
    assert.equal(engine.getToast('new')!.status, 'visible');
    clock.advance(20);
    assert.equal(engine.getToast('new')!.status, 'dismissing');
    clock.advance(30);
    assert.equal(engine.getToast('new'), null);
});
test('isolates each snapshot and consumer failure while retaining only opaque data identity', function (t) {
    const consoleError = t.mock.method(console, 'error', () => { });
    const { engine, changes } = createFixture(t);
    const data = { value: 1 };
    let laterState;
    engine.subscribe(state => {
        state.visible[0].title = 'corrupted';
        state.visible.length = 0;
        state.maxVisible = 999;
        throw new Error('consumer failed');
    });
    engine.subscribe(state => { laterState = state; });
    const reference = engine.createToast({ title: 'Original', data });
    assert.equal(laterState.visible[0].title, 'Original');
    assert.equal(laterState.maxVisible, 3);
    assert.equal(consoleError.mock.callCount(), 1);
    changes.at(-1)!.visible[0].title = 'changed onChange';
    laterState.visible.length = 0;
    const copy = engine.getToast(reference!)!;
    copy.id = 'changed';
    copy.title = 'changed';
    const state = engine.getState();
    state.visible[0].generation = -1;
    state.visible.length = 0;
    assert.equal(engine.getToast(reference!)!.title, 'Original');
    assert.equal(engine.getToast(reference!)!.data, data);
    data.value = 2;
    assert.equal(engine.getToast(reference!)!.data.value, 2);
});
test('deduplicates subscriber identity and makes old unsubscribe handles idempotent', function (t) {
    const { engine } = createFixture(t);
    let calls = 0;
    function listener() { calls++; }
    const first = engine.subscribe(listener);
    const duplicate = engine.subscribe(listener);
    assert.equal(calls, 0);
    engine.createToast({ id: 'task' });
    assert.equal(calls, 1);
    first();
    engine.updateToast('task', { title: 'unobserved' });
    assert.equal(calls, 1);
    const later = engine.subscribe(listener);
    duplicate();
    first();
    engine.updateToast('task', { title: 'observed' });
    assert.equal(calls, 2);
    later();
    later();
    assert.throws(() => engine.subscribe(null), TypeError);
});
test('nested mutations supersede remaining stale delivery and no-ops do not emit', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 1
        } });
    const received: string[] = [];
    engine.subscribe(state => {
        if (state.visible[0]?.title === 'outer')
            engine.updateToast('task', { title: 'nested' });
    });
    engine.subscribe(state => { received.push(state.visible[0]?.title ?? 'empty'); });
    engine.createToast({ id: 'task', title: 'outer' });
    assert.deepEqual(received, ['nested']);
    const count = changes.length;
    assert.equal(engine.updateToast('task', { title: 'nested' }), false);
    engine.config.limits.maxVisible = 1;
    clock.elapse(1);
    engine.getState();
    assert.equal(changes.length, count);
    engine.createToast({ id: 'queued' });
    assert.equal(changes.length, count + 1);
    engine.dismissToast('queued');
    assert.equal(changes.length, count + 2);
    engine.dismissToast('queued');
    assert.equal(changes.length, count + 2);
});
test('uses current onChange and onError configuration for subsequent notifications', async function (t) {
    const { engine, changes, errors } = createFixture(t);
    const currentChanges = [];
    const currentErrors = [];
    engine.config.events.onChange = state => currentChanges.push(state);
    engine.config.events.onError = error => currentErrors.push(error);
    assert.equal(currentChanges.length, 0);
    const handle = engine.createPromiseToast(Promise.resolve('done'), {
        loading: { id: 'task' },
        success() { throw new Error('format failed'); },
        error: {},
    })!;
    await handle.promise;
    assert.equal(changes.length, 1);
    assert.equal(currentChanges.length, 2);
    assert.equal(currentErrors[0].id, 'promise-content-failed');
    assert.deepEqual(errors, []);
    engine.config.events.onChange = undefined;
    engine.config.events.onError = undefined;
    engine.createToast({});
    assert.equal(currentChanges.length, 2);
});
test('destruction releases timers and subscribers and leaves neutral actions without reading inputs', async function (t) {
    const { engine, clock, changes, errors } = createFixture(t, { limits: {
            maxVisible: 2
        }, timing: {
            removalDelayMs: 10
        } });
    const reference = engine.createToast({ id: 'finite' })!;
    const staleExpiry = clock.pending()[0].id;
    engine.dismissToast(reference);
    const staleRemoval = clock.pending()[0].id;
    const operation = Promise.withResolvers();
    let formatterCalls = 0;
    const handle = engine.createPromiseToast(operation.promise, {
        loading: { id: 'promise' },
        success() { formatterCalls++; return {}; },
        error: {},
    })!;
    engine.pause();
    const count = changes.length;
    let listenerCalls = 0;
    const unsubscribe = engine.subscribe(() => { listenerCalls++; });
    engine.destroy();
    engine.destroy();
    assert.deepEqual(engine.getState(), { config: engine.getState().config, visible: [], queued: [], maxVisible: 2, paused: false, destroyed: true });
    assert.deepEqual(clock.pending(), []);
    const unreadable = new Proxy({}, {
        get() { throw new Error('Do not read input after destroy'); },
        has() { throw new Error('Do not inspect input after destroy'); },
    });
    assert.equal(engine.createToast(unreadable), null);
    assert.equal(engine.updateToast(unreadable, unreadable), false);
    assert.equal(engine.getToast(unreadable), null);
    assert.equal(engine.hasToast(unreadable), false);
    assert.equal(engine.dismissToast(unreadable), false);
    assert.equal(engine.removeToast(unreadable), false);
    assert.equal(engine.pauseToast(unreadable), false);
    assert.equal(engine.resumeToast(unreadable), false);
    assert.equal(engine.pause(null), false);
    assert.equal(engine.resume(null), false);
    assert.equal(engine.clearToasts(), 0);
    assert.equal(engine.clearQueue(), 0);
    assert.equal(engine.createPromiseToast(unreadable, unreadable), null);
    engine.subscribe(unreadable)();
    unsubscribe();
    engine.config.limits.maxVisible = 5;
    assert.equal(engine.config.limits.maxVisible, 2);
    clock.elapse(10000);
    clock.fire(staleExpiry);
    clock.fire(staleRemoval);
    operation.resolve('original');
    assert.equal(await handle.promise, 'original');
    assert.equal(formatterCalls, 0);
    assert.equal(listenerCalls, 0);
    assert.equal(changes.length, count);
    assert.deepEqual(errors, []);
    assert.deepEqual(getIds(engine.getState()), { visible: [], queued: [] });
});
