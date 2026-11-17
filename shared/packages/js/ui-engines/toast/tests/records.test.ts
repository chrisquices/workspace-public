import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, getIds } from './helpers.ts';
test('admits by capacity and promotes by priority then original queue sequence', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 2
        }, timing: {
            durationMs: 100
        } });
    const first = engine.createToast({ id: 'first' });
    engine.createToast({ id: 'second' });
    const low = engine.createToast({ id: 'low', priority: 4 });
    engine.createToast({ id: 'equal-a', priority: 1 });
    engine.createToast({ id: 'equal-b', priority: 1 });
    engine.updateToast(low!, { priority: 1 });
    assert.deepEqual(getIds(engine.getState()), { visible: ['first', 'second'], queued: ['low', 'equal-a', 'equal-b'] });
    assert.equal(clock.pending().length, 2);
    const count = changes.length;
    assert.equal(engine.dismissToast(first!), true);
    assert.equal(changes.length, count + 1);
    assert.deepEqual(getIds(changes.at(-1)!), { visible: ['second', 'low'], queued: ['equal-a', 'equal-b'] });
    assert.ok(changes.at(-1)!.visible.every(toast => toast.status === 'visible'));
});
test('raises capacity immediately and lowering it never evicts admitted records', function (t) {
    const { engine } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 0
        } });
    for (const id of ['a', 'b', 'c', 'd'])
        engine.createToast({ id });
    engine.config.limits.maxVisible = 3;
    assert.deepEqual(getIds(engine.getState()), { visible: ['a', 'b', 'c'], queued: ['d'] });
    engine.config.limits.maxVisible = 1;
    engine.removeToast('b');
    assert.deepEqual(getIds(engine.getState()), { visible: ['a', 'c'], queued: ['d'] });
    engine.removeToast('a');
    assert.deepEqual(getIds(engine.getState()), { visible: ['c'], queued: ['d'] });
    engine.removeToast('c');
    assert.deepEqual(getIds(engine.getState()), { visible: ['d'], queued: [] });
});
test('upserts preserve a lifetime and visible order while generated IDs skip collisions', function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 0
        } });
    const manual = engine.createToast({ id: 'toast-1', title: 'before' });
    const generated = engine.createToast({ title: 'generated' });
    const updated = engine.createToast({ id: 'toast-1', title: 'after', priority: -10 });
    assert.deepEqual(updated, manual);
    assert.notEqual(generated!.id, manual!.id);
    assert.deepEqual(getIds(engine.getState()).visible, [manual!.id, generated!.id]);
    assert.equal(engine.getToast(manual!)!.title, 'after');
    engine.removeToast(manual!);
    const replacement = engine.createToast({ id: manual!.id });
    assert.notEqual(replacement!.generation, manual!.generation);
    assert.equal(engine.getToast(manual!), null);
    assert.equal(engine.updateToast(manual!, { title: 'stale' }), false);
    assert.equal(engine.pauseToast(manual!), false);
    assert.equal(engine.resumeToast(manual!), false);
    assert.equal(engine.dismissToast(manual!), false);
    assert.equal(engine.removeToast(manual!), false);
    assert.equal(engine.hasToast(replacement!), true);
});
test('validates captured input atomically without coercing or trimming values', function (t) {
    const { engine, changes } = createFixture(t);
    const reference = engine.createToast({ id: ' ', title: '', data: undefined });
    const before = engine.getState();
    const count = changes.length;
    for (const input of [
        null, [], 1, { title: undefined }, { description: null }, { variant: 'other' },
        { durationMs: -1 }, { durationMs: Infinity }, { durationMs: 2 ** 31 },
        { priority: NaN }, { priority: '1' }, { id: '' }, { id: undefined }, { status: 'visible' },
    ]) {
        assert.throws(() => engine.createToast(input), TypeError);
    }
    for (const patch of [{ title: 'partial', durationMs: -1 }, { id: 'other' }, { generation: 2 }, { paused: true }, { removalDelayMs: 1 }]) {
        assert.throws(() => engine.updateToast(reference!, patch), TypeError);
    }
    for (const target of ['', null, {}, { id: ' ', generation: 0 }, { id: ' ', generation: 1.5 }]) {
        assert.throws(() => engine.getToast(target), TypeError);
    }
    for (const reason of ['', null, 1])
        assert.throws(() => engine.pause(reason), TypeError);
    assert.deepEqual(engine.getState(), before);
    assert.equal(changes.length, count);
});
test('captures inherited fields once and preserves nested changes to omitted fields', function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 0
        } });
    const reference = engine.createToast({ id: 'task', title: 'old', description: 'old description', data: 'old data' });
    let reads = 0;
    const prototype = Object.defineProperty({}, 'title', {
        get() {
            reads++;
            engine.updateToast(reference!, { description: 'nested description', data: 'nested data', priority: 7 });
            return 'outer title';
        },
    });
    assert.equal(engine.updateToast(reference!, Object.create(prototype)), true);
    assert.equal(reads, 1);
    assert.deepEqual(engine.getToast(reference!), {
        ...reference, status: 'visible', title: 'outer title', description: 'nested description',
        variant: 'info', durationMs: 0, removalDelayMs: 0, paused: false, priority: 7, data: 'nested data',
    });
    assert.equal(engine.updateToast(reference!, { data: undefined }), true);
    assert.equal(engine.getToast(reference!)!.data, undefined);
});
test('captures a duplicate creation ID once and merges against its latest surviving record', function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 0
        } });
    const reference = engine.createToast({ id: 'task', description: 'before' });
    let idReads = 0;
    let titleReads = 0;
    const result = engine.createToast({
        get id() { idReads++; return 'task'; },
        get title() {
            titleReads++;
            engine.updateToast(reference!, { description: 'nested', data: 42 });
            return 'outer';
        },
    });
    assert.deepEqual(result, reference);
    assert.equal(idReads, 1);
    assert.equal(titleReads, 1);
    assert.equal(engine.getToast(reference!)!.description, 'nested');
    assert.equal(engine.getToast(reference!)!.data, 42);
});
test('abandons patches and creates when getters replace the pinned lifetime or fill its absence', function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 0
        } });
    const old = engine.createToast({ id: 'task' });
    assert.equal(engine.updateToast(old!, {
        get title() {
            engine.removeToast(old!);
            engine.createToast({ id: 'task', title: 'replacement' });
            return 'stale';
        },
    }), false);
    assert.equal(engine.getToast('task')!.title, 'replacement');
    assert.equal(engine.createToast({
        id: 'new',
        get title() {
            engine.createToast({ id: 'new', title: 'nested' });
            return 'outer';
        },
    }), null);
    assert.equal(engine.getToast('new')!.title, 'nested');
    assert.equal(engine.createToast({
        id: 'task',
        get title() {
            engine.removeToast('task');
            engine.createToast({ id: 'task', title: 'latest' });
            return 'stale';
        },
    }), null);
    assert.equal(engine.getToast('task')!.title, 'latest');
});
test('captures target accessors once and abandons input if capture destroys the engine', function (t) {
    const { engine } = createFixture(t, { timing: {
            durationMs: 0
        } });
    const reference = engine.createToast({ id: 'task' })!;
    let idReads = 0;
    let generationReads = 0;
    assert.equal(engine.updateToast({
        get id() { idReads++; return reference.id; },
        get generation() { generationReads++; return reference.generation; },
    }, { title: 'updated' }), true);
    assert.equal(idReads, 1);
    assert.equal(generationReads, 1);
    assert.equal(engine.updateToast(reference, {
        get title() { engine.destroy(); return 'ignored'; },
    }), false);
    assert.deepEqual(getIds(engine.getState()), { visible: [], queued: [] });
});
test('clears waiting records separately and clears the full collection without intermediate promotion', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 1
        } });
    engine.createToast({ id: 'visible' });
    const queued = engine.createToast({ id: 'queued' });
    assert.equal(engine.clearQueue(), 1);
    assert.equal(engine.hasToast(queued!), false);
    assert.deepEqual(getIds(engine.getState()), { visible: ['visible'], queued: [] });
    engine.createToast({ id: 'next' });
    engine.pause('global');
    const before = changes.length;
    assert.equal(engine.clearToasts(), 2);
    assert.equal(changes.length, before + 1);
    assert.deepEqual(getIds(changes.at(-1)!), { visible: [], queued: [] });
    assert.deepEqual(clock.pending(), []);
    assert.equal(engine.getState().paused, true);
    assert.equal(engine.clearToasts(), 0);
    assert.equal(engine.clearQueue(), 0);
    assert.equal(changes.length, before + 1);
    const future = engine.createToast({ id: 'future' });
    assert.equal(engine.getToast(future!)!.paused, true);
});
