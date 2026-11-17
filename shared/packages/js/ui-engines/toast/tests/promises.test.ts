import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, getIds } from './helpers.ts';
test('success replaces loading content and uses captured admission duration and priority', async function (t) {
    const { engine, clock } = createFixture(t, { timing: {
            durationMs: 90, removalDelayMs: 10
        } });
    const operation = Promise.withResolvers<object>();
    const value = {};
    const handle = engine.createPromiseToast(operation.promise, {
        loading: { title: 'Saving', description: 'Please wait', data: { pending: true }, priority: 4 },
        success: {},
        error: { title: 'Failed' },
    })!;
    assert.equal(engine.getToast(handle.toast)!.durationMs, 0);
    assert.deepEqual(clock.pending(), []);
    engine.pauseToast(handle.toast, 'hover');
    engine.config.timing.durationMs = 1;
    engine.config.timing.removalDelayMs = 1;
    clock.advance(500);
    operation.resolve(value);
    assert.equal(await handle.promise, value);
    const toast = engine.getToast(handle.toast)!;
    assert.equal(toast.title, '');
    assert.equal(toast.description, '');
    assert.equal(toast.data, undefined);
    assert.equal(toast.variant, 'success');
    assert.equal(toast.durationMs, 90);
    assert.equal(toast.priority, 4);
    assert.equal(toast.removalDelayMs, 10);
    assert.equal(toast.paused, true);
    assert.deepEqual(clock.pending(), []);
    engine.resumeToast(handle.toast, 'hover');
    clock.advance(90);
    assert.equal(engine.getToast(handle.toast)!.status, 'dismissing');
    clock.advance(10);
    assert.equal(engine.hasToast(handle.toast), false);
});
test('operation rejection and synchronous factory failure retain their exact reasons', async function (t) {
    const { engine } = createFixture(t);
    const reason = new Error('operation failed');
    const operation = Promise.withResolvers();
    let formatted;
    const handle = engine.createPromiseToast(operation.promise, {
        loading: { description: 'Loading' }, success: {},
        error(value) { formatted = value; return { title: 'Failure', durationMs: 0, priority: -1 }; },
    })!;
    operation.reject(reason);
    await assert.rejects(handle.promise, value => value === reason);
    assert.equal(formatted, reason);
    assert.equal(engine.getToast(handle.toast)!.variant, 'error');
    assert.equal(engine.getToast(handle.toast)!.description, '');
    assert.equal(engine.getToast(handle.toast)!.durationMs, 0);
    let calls = 0;
    const synchronous = engine.createPromiseToast(() => {
        calls++;
        throw reason;
    }, { loading: {}, success: {}, error: { title: 'Synchronous failure' } })!;
    await assert.rejects(synchronous.promise, value => value === reason);
    assert.equal(calls, 1);
    assert.equal(engine.getToast(synchronous.toast)!.title, 'Synchronous failure');
});
test('captures static branch fields once before admission and retains opaque data identity', async function (t) {
    const { engine } = createFixture(t);
    const operation = Promise.withResolvers();
    const data = new Proxy({}, { get() { throw new Error('Opaque data must not be inspected'); } });
    const reads = { loading: 0, id: 0, success: 0, title: 0, error: 0 };
    const loading = { get id() { reads.id++; return 'task'; }, title: 'Loading' };
    const success = { get title() { reads.title++; return 'Captured title'; }, data };
    const messages = {
        get loading() { reads.loading++; return loading; },
        get success() { reads.success++; return success; },
        get error() { reads.error++; return {}; },
    };
    const handle = engine.createPromiseToast(operation.promise, messages)!;
    loading.title = 'mutated loading';
    Object.defineProperty(success, 'title', { value: 'mutated success' });
    Object.defineProperty(messages, 'success', { value: { title: 'replacement' } });
    operation.resolve('done');
    assert.equal(await handle.promise, 'done');
    assert.deepEqual(reads, { loading: 1, id: 1, success: 1, title: 1, error: 1 });
    assert.equal(engine.getToast(handle.toast)!.title, 'Captured title');
    assert.equal(engine.getToast(handle.toast)!.data, data);
});
test('captures formatter identity and isolates the public handle reference from settlement', async function (t) {
    const { engine } = createFixture(t);
    const operation = Promise.withResolvers<string>();
    const messages = { loading: { id: 'task' }, success: (value: string) => ({ title: value }), error: {} };
    const handle = engine.createPromiseToast(operation.promise, messages)!;
    messages.success = () => { throw new Error('Replacement formatter must not run'); };
    handle.toast.id = 'changed';
    handle.toast.generation = -1;
    operation.resolve('captured formatter');
    assert.equal(await handle.promise, 'captured formatter');
    assert.equal(engine.getToast('task')!.title, 'captured formatter');
});
test('validates promise descriptors before admission or factory invocation', function (t) {
    const { engine, changes } = createFixture(t);
    const existing = engine.createToast({ id: 'task', title: 'Original' });
    let calls = 0;
    function operation() { calls++; return Promise.resolve('done'); }
    const before = engine.getState();
    const count = changes.length;
    for (const messages of [
        null, {}, { loading: {}, success: {}, error: null },
        { loading: { durationMs: undefined }, success: {}, error: {} },
        { loading: { id: 'task' }, success: { priority: Infinity }, error: {} },
        { loading: {}, success: {}, error: { id: 'forbidden' } },
    ]) {
        assert.throws(() => engine.createPromiseToast(operation, messages), TypeError);
    }
    assert.throws(() => engine.createPromiseToast(123, { loading: {}, success: {}, error: {} }), TypeError);
    assert.deepEqual(engine.getState(), before);
    assert.equal(engine.getToast(existing!)!.title, 'Original');
    assert.equal(changes.length, count);
    assert.equal(calls, 0);
});
test('merges promise admission against the latest same lifetime after branch capture', async function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 100, removalDelayMs: 20
        } });
    const reference = engine.createToast({ id: 'task', title: 'Before', description: 'Before' });
    const operation = Promise.withResolvers();
    const handle = engine.createPromiseToast(operation.promise, {
        loading: { id: 'task', title: 'Loading' },
        get success() {
            engine.updateToast(reference!, { description: 'nested', durationMs: 30, priority: 7 });
            engine.pauseToast(reference!, 'focus');
            return {};
        },
        error: {},
    })!;
    assert.deepEqual(handle.toast, reference);
    assert.equal(engine.getToast(reference!)!.title, 'Loading');
    assert.equal(engine.getToast(reference!)!.description, 'nested');
    operation.resolve(undefined);
    await handle.promise;
    const toast = engine.getToast(reference!)!;
    assert.equal(toast.durationMs, 30);
    assert.equal(toast.priority, 7);
    assert.equal(toast.removalDelayMs, 20);
    assert.equal(toast.paused, true);
    assert.equal(toast.description, '');
});
test('explicit zero loading duration overrides an existing ordinary duration', async function (t) {
    const { engine, clock } = createFixture(t, { timing: {
            durationMs: 100
        } });
    engine.createToast({ id: 'task' });
    const handle = engine.createPromiseToast(Promise.resolve('done'), {
        loading: { id: 'task', durationMs: 0 }, success: {}, error: {},
    })!;
    await handle.promise;
    assert.equal(engine.getToast(handle.toast)!.durationMs, 0);
    assert.deepEqual(clock.pending(), []);
});
test('stale or closing admission never invokes a factory or adopts an existing thenable', function (t) {
    const { engine } = createFixture(t, { timing: {
            removalDelayMs: 20
        } });
    engine.createToast({ id: 'task' });
    let factoryCalls = 0;
    function operation() { factoryCalls++; return Promise.resolve(); }
    assert.equal(engine.createPromiseToast(operation, {
        loading: { id: 'task' },
        get success() {
            engine.removeToast('task');
            engine.createToast({ id: 'task', title: 'Replacement' });
            return {};
        },
        error: {},
    }), null);
    assert.equal(engine.createPromiseToast(operation, {
        loading: { id: 'absent' },
        get success() {
            engine.createToast({ id: 'absent' });
            return {};
        },
        error: {},
    }), null);
    engine.dismissToast('task');
    let adopted = 0;
    assert.equal(engine.createPromiseToast({ then() { adopted++; } }, {
        loading: { id: 'task' }, success: {}, error: {},
    }), null);
    assert.equal(factoryCalls, 0);
    assert.equal(adopted, 0);
});
for (const action of ['destroy', 'dismiss', 'replace', 'update']) {
    test(`an accepted factory runs exactly once after its subscriber performs ${action}`, async function (t) {
        const { engine } = createFixture(t);
        let factoryCalls = 0;
        let formatterCalls = 0;
        let handled = false;
        engine.subscribe(state => {
            if (handled || !state.visible.length)
                return;
            handled = true;
            if (action === 'destroy')
                engine.destroy();
            if (action === 'dismiss')
                engine.dismissToast('task');
            if (action === 'replace') {
                engine.removeToast('task');
                engine.createToast({ id: 'task', title: 'Replacement' });
            }
            if (action === 'update')
                engine.updateToast('task', { title: 'Manual' });
        });
        const handle = engine.createPromiseToast(() => {
            factoryCalls++;
            return Promise.resolve('original result');
        }, {
            loading: { id: 'task' },
            success() { formatterCalls++; return { title: 'Stale' }; },
            error: {},
        })!;
        assert.ok(handle);
        assert.equal(factoryCalls, 1);
        assert.equal(await handle.promise, 'original result');
        assert.equal(formatterCalls, 0);
        if (action === 'replace')
            assert.equal(engine.getToast('task')!.title, 'Replacement');
        if (action === 'update')
            assert.equal(engine.getToast('task')!.title, 'Manual');
        if (action === 'destroy' || action === 'dismiss')
            assert.equal(engine.hasToast('task'), false);
    });
}
for (const action of ['patch', 'upsert']) {
    test(`a manual no-op ${action} revokes promise ownership without an identical notification`, async function (t) {
        const { engine, changes } = createFixture(t);
        const operation = Promise.withResolvers();
        let formatCalls = 0;
        const handle = engine.createPromiseToast(operation.promise, {
            loading: { id: 'task' }, success() { formatCalls++; return {}; }, error: {},
        })!;
        const count = changes.length;
        if (action === 'patch')
            assert.equal(engine.updateToast(handle.toast, {}), true);
        else
            assert.deepEqual(engine.createToast({ id: 'task' }), handle.toast);
        assert.equal(changes.length, count);
        operation.resolve('done');
        assert.equal(await handle.promise, 'done');
        assert.equal(formatCalls, 0);
        assert.equal(engine.getToast('task')!.variant, 'loading');
    });
}
test('a newer promise replaces ownership and settles a queued record before promotion', async function (t) {
    const { engine, clock } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 50
        } });
    engine.createToast({ id: 'blocker', durationMs: 0 });
    const first = Promise.withResolvers();
    const second = Promise.withResolvers();
    let oldFormatCalls = 0;
    const old = engine.createPromiseToast(first.promise, {
        loading: { id: 'task', priority: 5 },
        success() { oldFormatCalls++; return { title: 'Old' }; }, error: {},
    })!;
    engine.createToast({ id: 'other', priority: 2 });
    const current = engine.createPromiseToast(second.promise, {
        loading: { id: 'task' },
        success: { title: 'New', priority: -1 }, error: {},
    })!;
    assert.deepEqual(current.toast, old.toast);
    first.resolve('old');
    await old.promise;
    assert.equal(oldFormatCalls, 0);
    second.resolve('new');
    await current.promise;
    assert.deepEqual(getIds(engine.getState()), { visible: ['blocker'], queued: ['task', 'other'] });
    assert.equal(engine.getToast(current.toast)!.title, 'New');
    assert.deepEqual(clock.pending(), []);
    engine.removeToast('blocker');
    clock.advance(49);
    assert.equal(engine.hasToast(current.toast), true);
    clock.advance(1);
    assert.equal(engine.hasToast(current.toast), false);
    assert.equal(engine.getToast('other')!.status, 'visible');
});
test('formatter invalidation suppresses result getters and result-getter invalidation prevents settlement', async function (t) {
    const { engine, errors } = createFixture(t);
    let resultReads = 0;
    const first = engine.createPromiseToast(Promise.resolve('first'), {
        loading: { id: 'first' },
        success() {
            engine.removeToast('first');
            engine.createToast({ id: 'first', title: 'Replacement' });
            return { get title() { resultReads++; return 'Stale'; } };
        },
        error: {},
    })!;
    await first.promise;
    assert.equal(resultReads, 0);
    assert.equal(engine.getToast('first')!.title, 'Replacement');
    const second = engine.createPromiseToast(Promise.resolve('second'), {
        loading: { id: 'second' },
        success() {
            return {
                get title() {
                    resultReads++;
                    engine.updateToast('second', { title: 'Manual' });
                    return 'Stale';
                },
                description: undefined,
            };
        },
        error: {},
    })!;
    assert.equal(await second.promise, 'second');
    assert.equal(resultReads, 1);
    assert.equal(engine.getToast('second')!.title, 'Manual');
    assert.deepEqual(errors, []);
});
test('formatter failures report and remove only the owned toast without changing operation outcomes', async function (t) {
    const { engine, errors } = createFixture(t, { limits: {
            maxVisible: 1
        } });
    const formatterError = new Error('formatter failed');
    const value = {};
    const success = engine.createPromiseToast(Promise.resolve(value), {
        loading: { id: 'success' },
        success() { throw formatterError; },
        error: {},
    })!;
    engine.createToast({ id: 'waiting' });
    assert.equal(await success.promise, value);
    assert.equal(engine.hasToast(success.toast), false);
    assert.equal(engine.getToast('waiting')!.status, 'visible');
    assert.equal(errors[0].id, 'promise-content-failed');
    assert.equal(errors[0].metadata.error, formatterError);
    const reason = new Error('operation failed');
    const failure = engine.createPromiseToast(() => Promise.reject(reason), {
        loading: { id: 'failure' }, success: {},
        error() { return { durationMs: -1 }; },
    })!;
    await assert.rejects(failure.promise, error => error === reason);
    assert.equal(engine.hasToast(failure.toast), false);
    assert.equal(errors[1].id, 'promise-content-failed');
});
test('error-report callback reentrancy protects a replacement from formatter cleanup', async function (t) {
    const { engine } = createFixture(t);
    engine.config.events.onError = () => {
        engine.removeToast('task');
        engine.createToast({ id: 'task', title: 'Replacement' });
    };
    const handle = engine.createPromiseToast(Promise.resolve('done'), {
        loading: { id: 'task' },
        success() { throw new Error('formatter failed'); },
        error: {},
    })!;
    assert.equal(await handle.promise, 'done');
    assert.equal(engine.getToast('task')!.title, 'Replacement');
    assert.notEqual(engine.getToast('task')!.generation, handle.toast.generation);
});
test('adopts a captured then method once with its receiver without reading its call property', async function (t) {
    const { engine } = createFixture(t);
    let reads = 0;
    let calls = 0;
    let receiver;
    function then(resolve) {
        calls++;
        receiver = this;
        resolve('value');
    }
    Object.defineProperty(then, 'call', { get() { throw new Error('Do not read call'); } });
    const operation = { get then() { reads++; return then; } };
    const handle = engine.createPromiseToast(operation, { loading: {}, success: {}, error: {} })!;
    assert.equal(await handle.promise, 'value');
    assert.equal(reads, 1);
    assert.equal(calls, 1);
    assert.equal(receiver, operation);
    assert.equal(engine.getToast(handle.toast)!.variant, 'success');
});
