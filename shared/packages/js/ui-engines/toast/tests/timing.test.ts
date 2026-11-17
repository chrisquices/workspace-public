import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, getIds } from './helpers.ts';
test('queued records receive a full expiry budget only upon admission', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 100
        } });
    engine.createToast({ id: 'first' });
    const queued = engine.createToast({ id: 'queued' });
    assert.equal(clock.pending().length, 1);
    clock.advance(99);
    assert.deepEqual(getIds(engine.getState()), { visible: ['first'], queued: ['queued'] });
    const count = changes.length;
    clock.advance(1);
    assert.deepEqual(getIds(engine.getState()), { visible: ['queued'], queued: [] });
    assert.equal(changes.length, count + 1);
    clock.advance(99);
    assert.equal(engine.hasToast(queued!), true);
    clock.advance(1);
    assert.equal(engine.hasToast(queued!), false);
});
test('text and finite variant updates preserve time while an explicit equal duration resets it', function (t) {
    const { engine, clock, changes } = createFixture(t, { timing: {
            durationMs: 100
        } });
    const reference = engine.createToast({ title: 'initial' });
    clock.advance(70);
    engine.updateToast(reference!, { title: 'updated', variant: 'success', priority: -3, data: {} });
    clock.advance(20);
    const count = changes.length;
    assert.equal(engine.updateToast(reference!, { durationMs: 100 }), true);
    assert.equal(changes.length, count);
    clock.advance(99);
    assert.equal(engine.hasToast(reference!), true);
    clock.advance(1);
    assert.equal(engine.hasToast(reference!), false);
});
test('loading preserves ordinary duration and persistence transitions reset the finite budget', function (t) {
    const { engine, clock } = createFixture(t, { timing: {
            durationMs: 100
        } });
    const reference = engine.createToast({ variant: 'loading', durationMs: 80 });
    assert.equal(engine.getToast(reference!)!.durationMs, 0);
    assert.deepEqual(clock.pending(), []);
    clock.advance(500);
    engine.updateToast(reference!, { variant: 'success' });
    clock.advance(60);
    engine.updateToast(reference!, { variant: 'loading' });
    assert.deepEqual(clock.pending(), []);
    engine.updateToast(reference!, { variant: 'info' });
    clock.advance(79);
    assert.equal(engine.hasToast(reference!), true);
    clock.advance(1);
    assert.equal(engine.hasToast(reference!), false);
    const persistent = engine.createToast({ durationMs: 0 });
    clock.advance(500);
    assert.equal(engine.hasToast(persistent!), true);
    engine.updateToast(persistent!, { durationMs: 50 });
    clock.advance(50);
    assert.equal(engine.hasToast(persistent!), false);
});
test('record and engine pause reasons compose and resume the saved remainder', function (t) {
    const { engine, clock, changes } = createFixture(t, { timing: {
            durationMs: 100
        } });
    const reference = engine.createToast({});
    clock.advance(40);
    assert.equal(engine.pauseToast(reference!, 'hover'), true);
    assert.equal(engine.pauseToast(reference!, 'hover'), false);
    assert.equal(engine.pause('hidden'), true);
    const count = changes.length;
    assert.equal(engine.pauseToast(reference!, 'focus'), true);
    assert.equal(engine.pause('dialog'), true);
    assert.equal(changes.length, count);
    assert.deepEqual(clock.pending(), []);
    clock.advance(1000);
    assert.equal(engine.resumeToast(reference!, 'hover'), true);
    assert.equal(engine.resume('hidden'), true);
    assert.equal(engine.resume('dialog'), true);
    assert.equal(engine.getToast(reference!)!.paused, true);
    assert.deepEqual(clock.pending(), []);
    assert.equal(engine.resumeToast(reference!, 'focus'), true);
    assert.equal(engine.resumeToast(reference!, 'focus'), false);
    clock.advance(59);
    assert.equal(engine.hasToast(reference!), true);
    clock.advance(1);
    assert.equal(engine.hasToast(reference!), false);
});
test('remembers pause reasons for queued and persistent records and resets while paused', function (t) {
    const { engine, clock } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 100
        } });
    engine.pause('hidden');
    const persistent = engine.createToast({ id: 'persistent', durationMs: 0 });
    const waiting = engine.createToast({ id: 'waiting' });
    engine.pauseToast(waiting!, 'hover');
    engine.resume('hidden');
    engine.updateToast(persistent!, { durationMs: 40 });
    clock.advance(40);
    assert.deepEqual(getIds(engine.getState()), { visible: ['waiting'], queued: [] });
    assert.deepEqual(clock.pending(), []);
    engine.updateToast(waiting!, { durationMs: 25 });
    clock.advance(1000);
    engine.resumeToast(waiting!, 'hover');
    clock.advance(24);
    assert.equal(engine.hasToast(waiting!), true);
    clock.advance(1);
    assert.equal(engine.hasToast(waiting!), false);
});
test('an exhausted finite budget dismisses immediately when its last reason clears', function (t) {
    const { engine, clock } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 10
        } });
    const reference = engine.createToast({ id: 'expired' });
    engine.createToast({ id: 'next' });
    clock.elapse(15);
    engine.pauseToast(reference!, 'hover');
    assert.equal(engine.hasToast(reference!), true);
    assert.deepEqual(clock.pending(), []);
    engine.resumeToast(reference!, 'hover');
    assert.equal(engine.hasToast(reference!), false);
    assert.deepEqual(getIds(engine.getState()), { visible: ['next'], queued: [] });
    assert.deepEqual(clock.pending().map(timer => timer.deadline), [25]);
});
test('positive removal delay retains capacity and cleanup ignores pauses or repeat dismissal', function (t) {
    const { engine, clock } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            durationMs: 10, removalDelayMs: 30
        } });
    const reference = engine.createToast({ id: 'first' });
    engine.createToast({ id: 'next' });
    clock.advance(10);
    assert.equal(engine.getToast(reference!)!.status, 'dismissing');
    assert.equal(engine.hasToast(reference!), true);
    assert.deepEqual(getIds(engine.getState()), { visible: ['first'], queued: ['next'] });
    clock.advance(10);
    engine.pause('hidden');
    assert.equal(engine.dismissToast(reference!), false);
    assert.equal(engine.pauseToast(reference!), false);
    assert.equal(engine.resumeToast(reference!), false);
    assert.equal(engine.updateToast(reference!, { title: 'ignored' }), false);
    assert.equal(engine.createToast({ id: reference!.id }), null);
    clock.advance(20);
    assert.equal(engine.hasToast(reference!), false);
    assert.equal(engine.getToast('next')!.status, 'visible');
    assert.equal(engine.getToast('next')!.paused, true);
    assert.deepEqual(clock.pending(), []);
});
test('queued dismissal is immediate and explicit removal shortens cleanup with no stale callback effects', function (t) {
    const { engine, clock } = createFixture(t, { limits: {
            maxVisible: 1
        }, timing: {
            removalDelayMs: 20
        } });
    const first = engine.createToast({ id: 'first' });
    const waiting = engine.createToast({ id: 'waiting' });
    engine.dismissToast(waiting!);
    assert.equal(engine.hasToast(waiting!), false);
    engine.dismissToast(first!);
    const removal = clock.pending()[0].id;
    engine.removeToast(first!);
    const replacement = engine.createToast({ id: 'first', durationMs: 0 });
    clock.elapse(50);
    clock.fire(removal);
    assert.equal(engine.hasToast(replacement!), true);
});
test('stale expiry revisions cannot replace reset timers or remove a reused ID', function (t) {
    const { engine, clock } = createFixture(t, { timing: {
            durationMs: 100, removalDelayMs: 10
        } });
    const reference = engine.createToast({ id: 'task' });
    const oldTimer = clock.pending()[0].id;
    clock.advance(40);
    engine.updateToast(reference!, { durationMs: 100 });
    const resetTimer = clock.pending()[0].id;
    clock.elapse(70);
    clock.fire(oldTimer);
    assert.equal(engine.getToast(reference!)!.status, 'visible');
    assert.equal(clock.pending()[0].id, resetTimer);
    engine.dismissToast(reference!);
    const removal = clock.pending()[0].id;
    clock.fire(resetTimer);
    assert.equal(engine.getToast(reference!)!.status, 'dismissing');
    assert.equal(clock.pending()[0].id, removal);
    engine.removeToast(reference!);
    const replacement = engine.createToast({ id: 'task', durationMs: 0 });
    clock.fire(removal);
    assert.equal(engine.hasToast(replacement!), true);
});
for (const kind of ['expiry', 'removal']) {
    test(`early ${kind} callbacks retain the original deadline even if reading time advances the clock`, function (t) {
        const { engine, clock } = createFixture(t, { timing: {
                durationMs: 100, removalDelayMs: kind === 'removal' ? 100 : 0
            } });
        const reference = engine.createToast({});
        if (kind === 'removal')
            engine.dismissToast(reference!);
        const timer = clock.pending()[0].id;
        clock.elapse(20);
        let reads = 0;
        t.mock.method(globalThis.performance, 'now', () => {
            if (++reads === 2)
                clock.elapse(7);
            return clock.now;
        });
        clock.fire(timer);
        assert.deepEqual(clock.pending().map(timer => timer.deadline), [100]);
        clock.advance(72);
        assert.equal(engine.hasToast(reference!), true);
        clock.advance(1);
        assert.equal(engine.hasToast(reference!), false);
    });
}
test('global resume dismisses exhausted records and promotes once before publishing', function (t) {
    const { engine, clock, changes } = createFixture(t, { limits: {
            maxVisible: 2
        }, timing: {
            durationMs: 10
        } });
    engine.createToast({ id: 'a' });
    engine.createToast({ id: 'b' });
    engine.createToast({ id: 'c' });
    engine.createToast({ id: 'd' });
    clock.elapse(11);
    engine.pause();
    const before = changes.length;
    engine.resume();
    assert.equal(changes.length, before + 1);
    assert.deepEqual(getIds(changes.at(-1)!), { visible: ['c', 'd'], queued: [] });
});
