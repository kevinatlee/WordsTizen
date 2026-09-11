'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function harness(options = {}) {
    const events = {};
    const timers = new Map();
    const saver = [];
    let id = 0, exits = 0;
    const document = { hidden: false, activeElement: null };
    function element() {
        return { style: {}, hidden: false, children: [], attrs: {},
            focus() { document.activeElement = this; },
            addEventListener(name, fn) { this[name] = fn; },
            setAttribute(name, value) { this.attrs[name] = value; },
            appendChild(child) { this.children.push(child); },
            removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
            getBoundingClientRect() { return { width: 1920, height: 1080 }; } };
    }
    const elements = Object.fromEntries(['surface', 'loading', 'error', 'retry'].map(key => [key, element()]));
    document.body = element();
    document.getElementById = key => elements[key];
    document.createElement = element;
    const listen = (name, fn) => (events[name] ||= []).push(fn);
    document.addEventListener = listen;
    const window = { document, navigator: { onLine: options.online !== false, userAgent: 'test' },
        screen: { width: 1920, height: 1080 }, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
        addEventListener: listen, setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; },
        clearTimeout(key) { timers.delete(key); }, WordsUrlPolicy: require('../js/url-policy'),
        WordsViewport: require('../js/viewport'), tizen: { application: { getCurrentApplication() {
            return { exit() { exits++; } };
        } } } };
    if (!options.noApi) window.webapis = { appcommon: {
        AppCommonScreenSaverState: { SCREEN_SAVER_ON: 1, SCREEN_SAVER_OFF: 0 },
        setScreenSaver(value, success, failure) {
            saver.push(value);
            if (options.throwApi) throw new Error('unavailable');
            if (options.failApi) failure(new Error('unavailable'));
            else if (!options.hangApi) success();
        }
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/app.js'), 'utf8'),
        { window, document, navigator: window.navigator, console: { warn() {}, info() {} } });
    return { window, document, elements, saver, timers, exits: () => exits,
        frame: () => elements.surface.children[0],
        fire(name, values = {}) { for (const fn of events[name] || []) fn({ preventDefault() {}, ...values }); },
        expire(delay) { for (const [key, value] of [...timers]) if (value.delay === delay) { timers.delete(key); value.fn(); } } };
}
test('load, offline, remote Retry and stale callbacks', () => {
    const h = harness();
    const first = h.frame(), stale = first.onload;
    assert.equal(first.attrs.sandbox, 'allow-scripts allow-same-origin');
    first.onload();
    assert.equal(first.style.visibility, 'visible');
    assert.equal(h.timers.size, 0);
    h.window.navigator.onLine = false;
    h.fire('offline');
    assert.equal(h.elements.error.hidden, false);
    assert.equal(h.document.activeElement, h.elements.retry);
    assert.equal(h.saver.at(-1), 1);
    stale();
    assert.equal(h.frame(), undefined);
    h.window.navigator.onLine = true;
    h.fire('keydown', { keyCode: 13 });
    assert.ok(h.frame());
    assert.notEqual(h.frame(), first);
});
test('Enter preserves the iframe while loading and displayed', () => {
    for (const key of [{ keyCode: 13 }, { key: 'Enter' }]) {
        const h = harness();
        const original = h.frame();
        h.fire('keydown', key);
        assert.equal(h.frame(), original);
        assert.equal(h.timers.size, 1);
        original.onload();
        const saverCalls = h.saver.length;
        h.fire('keydown', key);
        assert.equal(h.frame(), original);
        assert.equal(h.frame().style.visibility, 'visible');
        assert.equal(h.timers.size, 0);
        assert.equal(h.saver.length, saverCalls);
    }
});
test('timeout, online recovery, iframe error and button click', () => {
    const h = harness();
    h.expire(30000);
    assert.equal(h.elements.error.hidden, false);
    h.fire('online');
    h.frame().onerror();
    assert.equal(h.elements.error.hidden, false);
    h.elements.retry.click();
    assert.ok(h.frame());
});
test('visibility restores screensaver and resume re-disables it', () => {
    const h = harness();
    h.frame().onload();
    h.document.hidden = true; h.fire('visibilitychange');
    assert.equal(h.saver.at(-1), 1);
    h.document.hidden = false; h.fire('visibilitychange');
    assert.equal(h.saver.at(-1), 0);
    h.fire('pagehide'); assert.equal(h.saver.at(-1), 1);
    h.fire('pageshow'); assert.equal(h.saver.at(-1), 0);
});
test('Back exits once, restores screensaver, tolerates missing/failing APIs', () => {
    for (const options of [{}, { noApi: true }, { failApi: true }, { throwApi: true }, { hangApi: true }]) {
        const h = harness(options);
        h.fire('keydown', { keyCode: 10009 });
        h.expire(500);
        h.fire('keydown', { keyCode: 10009 });
        assert.equal(h.exits(), 1);
        if (!options.noApi) assert.equal(h.saver.at(-1), 1);
    }
});
test('offline launch has a focused Retry and no iframe', () => {
    const h = harness({ online: false });
    assert.equal(h.frame(), undefined);
    assert.equal(h.document.activeElement, h.elements.retry);
});
