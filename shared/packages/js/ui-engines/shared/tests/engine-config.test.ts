import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createEngineConfig} from '../engine-config.ts';

function createFixture() {
    const values = {element: null, zoom: 1, offset: {x: 0, y: 0}, min: 0, max: 10, onChange: undefined};
    const blocked = new Set<string>();
    const notifications = [];
    const failures = [];
    const cleanups = [];
    let destroyed = false;
    const controller = createEngineConfig({
        values,
        layout: {
            element: {path: ['viewport', 'element']},
            zoom: {path: ['viewport', 'zoom']},
            offset: {path: ['viewport', 'offset'], keys: ['x', 'y']},
            min: {path: ['limits', 'min']},
            max: {path: ['limits', 'max']},
            onChange: {path: ['events', 'onChange'], optional: true},
        },
        blocked: Object.fromEntries(Object.keys(values).map(key => [key, () => blocked.has(key)])),
        validate(update) {
            if (update.values.min > update.values.max) throw new TypeError('Invalid limits');
            if (update.key === 'zoom' && (!Number.isFinite(update.value) || update.value <= 0)) throw new TypeError('Invalid zoom');
        },
        canApply: () => !destroyed,
        notify() { notifications.push(controller.getSnapshot()); },
        reportFailure(update, error) { failures.push({update, error}); },
        cleanups,
    });
    return {...controller, values, blocked, notifications, failures, destroy() {destroyed = true; for (const cleanup of cleanups) cleanup();}};
}

test('engine configuration only defers changed fields and rebases pending writes over live state', function () {
    const f = createFixture();
    f.blocked.add('element');
    f.config.viewport.zoom = 2;
    assert.equal(f.values.zoom, 2);
    f.config.viewport.element = 'next';
    assert.equal(f.values.element, null);
    assert.equal(f.config.viewport.element, 'next');
    f.values.zoom = 3;
    f.values.offset = {x: 12, y: 24};
    f.blocked.clear();
    f.sync();
    assert.equal(f.values.element, 'next');
    assert.equal(f.values.zoom, 3);
    assert.deepEqual(f.values.offset, {x: 12, y: 24});
});

test('engine configuration preserves live coordinates omitted from deferred partial writes', function () {
    const f = createFixture();
    f.blocked.add('offset');
    f.config.viewport.offset = {x: 10};
    f.values.offset = {x: 2, y: 30};
    f.config.viewport.offset.x = 20;
    f.blocked.clear();
    f.sync();
    assert.deepEqual(f.values.offset, {x: 20, y: 30});
});

test('engine configuration validates grouped changes atomically and retains valid queued writes after rejection', function () {
    const f = createFixture();
    f.blocked.add('min');
    f.config.limits = {min: 5};
    assert.throws(() => {f.config.limits = {min: 8, max: 7};}, /Invalid limits/);
    assert.equal(f.config.limits.min, 5);
    assert.equal(f.values.min, 0);
    f.config.limits = {max: 20, min: 15};
    assert.equal(f.values.max, 10);
    f.config.limits.max = 25;
    assert.equal(f.values.max, 10);
    f.blocked.clear();
    f.sync();
    assert.equal(f.values.min, 15);
    assert.equal(f.values.max, 25);
    assert.equal(f.notifications.length, 1);
});

test('engine configuration accepts dependent queued limits together', function () {
    const f = createFixture();
    f.blocked.add('max');
    f.config.limits.max = 20;
    f.config.limits.min = 15;
    assert.deepEqual(f.getSnapshot().limits, {min: 0, max: 10});
    f.blocked.clear();
    f.sync();
    assert.deepEqual(f.getSnapshot().limits, {min: 15, max: 20});
    assert.deepEqual(f.failures, []);
});

test('engine configuration keeps required undefined settings, clears optional callbacks and rejects old keys', function () {
    const f = createFixture();
    f.config.viewport.zoom = undefined;
    assert.equal(f.values.zoom, 1);
    const callback = () => {};
    f.config.events = {onChange: callback};
    assert.equal(f.values.onChange, callback);
    delete f.config.events.onChange;
    assert.equal(f.values.onChange, undefined);
    f.config.events.onChange = callback;
    f.config.events = {onChange: undefined};
    assert.equal(f.values.onChange, undefined);
    assert.throws(() => {f.config.zoom = 2;}, /Unknown/);
    assert.throws(() => {f.config.viewport = {other: true};}, /Unknown/);
    assert.throws(() => {delete f.config.viewport.zoom;}, /cannot be deleted/);
});

test('engine configuration exposes defensive applied snapshots and drops pending changes at destruction', function () {
    const f = createFixture();
    const initial = f.getSnapshot();
    assert.ok(Object.isFrozen(initial.viewport.offset));
    assert.ok(!Object.hasOwn(initial, 'events'));
    assert.equal(f.getSnapshot(), initial);
    f.blocked.add('zoom');
    f.config.viewport.zoom = 2;
    assert.equal(f.getSnapshot(), initial);
    f.destroy();
    f.blocked.clear();
    f.sync();
    assert.equal(f.values.zoom, 1);
    assert.deepEqual(f.notifications, []);
});

test('engine configuration treats application-owned data as opaque identity without traversing getters', function () {
    let reads = 0;
    function createData() {return {get value() {reads++; throw new Error('Do not traverse');}};}
    const original = createData();
    const replacement = createData();
    const values = {sources: [{items: [{data: original}]}]};
    const controller = createEngineConfig({
        values,
        layout: {sources: {path: ['sources']}},
        excludeSnapshot: ['sources'],
        isOpaque: (_value, path) => path.length === 5 && path[0] === 'sources' && path[2] === 'items' && path[4] === 'data',
        validate() {}, notify() {}, cleanups: [],
    });
    controller.config.sources = [{items: [{data: replacement}]}];
    assert.equal(values.sources[0].items[0].data, replacement);
    assert.equal(controller.config.sources[0].items[0].data, replacement);
    assert.equal(reads, 0);
});
