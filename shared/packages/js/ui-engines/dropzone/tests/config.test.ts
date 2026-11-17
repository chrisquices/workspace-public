import {configAt} from '../../shared/tests/config-path.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDropzone } from 'workspace-packages/ui-engines/dropzone';
import { createFixture, createHost, file } from './helpers.ts';
test('dropzone requires an element with DOM event capabilities', function () {
    for (const element of [undefined, null, false, {}, { addEventListener: 1 }]) {
        assert.throws(() => createDropzone({ element: element, config: {} }), /element.*DOM element/);
    }
});
for (const name of ["events.onChange", "events.onError"]) {
    test(`dropzone validates ${name} before attaching listeners`, function () {
        for (const value of [null, false, 1, '', [], {}]) {
            const host = createHost();
            assert.throws(() => createDropzone({ element: host.element, config: configAt(name, value) }), new RegExp(`${name}.*function`));
            assert.equal(host.element.registrations.length, 0);
            assert.equal(host.created.length, 0);
        }
    });
}
for (const name of ["files.accept", "files.exclude"]) {
    test(`dropzone validates the existing dotted ${name} extension list`, function () {
        for (const value of [null, '.png', [], [null], [''], [' '], [' .png'], ['.png '], ['png']]) {
            const host = createHost();
            assert.throws(() => createDropzone({ element: host.element, config: configAt(name, value) }), error => error instanceof TypeError && error.message.includes(name));
            assert.equal(host.element.registrations.length, 0);
        }
    });
}
for (const name of ["files.limits.minSize", "files.limits.maxSize", "files.limits.maxTotalSize", "files.limits.maxFiles"]) {
    test(`dropzone requires a positive finite ${name}`, function () {
        for (const value of [null, false, 0, -1, NaN, Infinity, -Infinity, '2', {}]) {
            assert.throws(() => createDropzone({ element: createHost().element, config: configAt(name, value) }), new RegExp(name));
        }
    });
}
test('dropzone validates count integrality and compatible size limits', function (t) {
    assert.throws(() => createDropzone({ element: createHost().element, config: { files: {
                limits: {
                    maxFiles: 1.5
                }
            } } }), /maxFiles.*whole number/);
    assert.throws(() => createDropzone({ element: createHost().element, config: { files: {
                limits: {
                    minSize: 3, maxSize: 2
                }
            } } }), /minSize.*maxSize/);
    createFixture(t, { files: {
            limits: {
                minSize: 1.5, maxSize: 1.5, maxTotalSize: 1.5, maxFiles: 1
            }
        } });
});
for (const name of ["files.multiple.enabled", "picker.openOnClick.enabled", "enabled", "files.dedupe.enabled", "previews.video.enabled", "thumbnails.image.enabled", "thumbnails.video.enabled", "thumbnails.audio.enabled"]) {
    test(`dropzone requires boolean ${name}`, function (t) {
        for (const value of [null, 0, 1, 'true', [], {}]) {
            assert.throws(() => createDropzone({ element: createHost().element, config: configAt(name, value) }), new RegExp(`${name}.*boolean`));
        }
        createFixture(t, configAt(name, false));
        createFixture(t, configAt(name, true));
    });
}
test('dropzone defaults are empty, enabled, and silent; picker belongs to the element document', function (t) {
    const f = createFixture(t);
    assert.deepEqual(f.engine.getState(), { config: f.engine.getState().config, files: [], count: 0, totalSize: 0, draggingOver: false, disabled: false });
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.created, ['input', 'input']);
    assert.equal(f.picker.type, 'file');
    assert.equal(f.picker.multiple, true);
    assert.equal(f.picker.accept, '');
    f.engine.openFilePicker();
    assert.equal(f.picker.clicks, 1);
});
test('dropzone passes explicit picker configuration and initial disabled state', function (t) {
    const f = createFixture(t, { files: {
            accept: ['.PNG', '.tar.gz'], exclude: ['.bad'],
            multiple: {
                enabled: false
            }
        }, enabled: false });
    assert.equal(f.picker.accept, '.PNG,.tar.gz');
    assert.equal(f.picker.multiple, false);
    assert.equal(f.engine.getState().disabled, true);
    assert.deepEqual(f.events, []);
    f.engine.openFilePicker();
    assert.equal(f.picker.clicks, 0);
});
test('dropzone rejects invalid subscribers and supports absent optional callbacks', function (t) {
    const host = createHost();
    const engine = createDropzone({ element: host.element, config: { events: {
                onChange: undefined, onError: undefined
            } } });
    t.after(() => engine.destroy());
    for (const listener of [null, undefined, 1, false, {}])
        assert.throws(() => engine.subscribe(listener), /listener.*function/);
    (engine.config.enabled = false);
    assert.equal(engine.getState().disabled, true);
});
test('dropzone replaces and removes reactive change callbacks while sharing subscriber identity', function (t) {
    const host = createHost();
    const previous = [];
    const current = [];
    function handlePrevious(state) { previous.push(state.disabled); }
    function handleCurrent(state) { current.push(state.disabled); }
    const engine = createDropzone({ element: host.element, config: { events: {
                onChange: handlePrevious
            } } });
    t.after(() => engine.destroy());
    engine.subscribe(handlePrevious);
    engine.config.enabled = false;
    assert.deepEqual(previous, [true]);
    engine.subscribe(handleCurrent);
    engine.config.events.onChange = handleCurrent;
    engine.config.enabled = true;
    assert.deepEqual(previous, [true]);
    assert.deepEqual(current, [false]);
    engine.config.events.onChange = undefined;
    engine.config.enabled = false;
    assert.deepEqual(current, [false]);
});
test('dropzone keeps native picker settings and file intake in sync with reactive config', function (t) {
    const f = createFixture(t);
    const accept = ['.png'];
    f.engine.config.files.accept = accept;
    accept.push('.bad');
    assert.equal(f.picker.accept, '.png');
    f.engine.config.files.accept.push('.jpg');
    assert.equal(f.picker.accept, '.png,.jpg');
    const image = file('image.jpg');
    assert.deepEqual(f.engine.addFiles(image).accepted, [image]);
    f.engine.config.files.multiple.enabled = false;
    assert.equal(f.picker.multiple, false);
    assert.equal(f.engine.addFiles(file('other.png')).errors[0].id, 'single-file');
    const before = f.engine.getState();
    assert.throws(() => { f.engine.config.files.accept.push('jpg'); }, /accept/);
    assert.deepEqual(f.engine.getState(), before);
    assert.equal(f.picker.accept, '.png,.jpg');
    f.engine.config.picker.openOnClick.enabled = false;
    f.element.emit('click');
    assert.equal(f.picker.clicks, 0);
    f.engine.config.picker.openOnClick.enabled = true;
    f.element.emit('click');
    assert.equal(f.picker.clicks, 1);
});
