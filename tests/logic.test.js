'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../js/url-policy');
const viewport = require('../js/viewport');
test('URL policy accepts only the exact HTTPS authority without userinfo', () => {
    for (const url of ['https://words.atlee.io/display', 'https://words.atlee.io/some-valid-path',
        'https://words.atlee.io:443/display', 'HTTPS://WORDS.ATLEE.IO/display?q=one#two']) {
        assert.equal(policy.isAllowed(url), true, url);
    }
    for (const url of ['http://words.atlee.io/display', 'https://evil.example/display',
        'https://words.atlee.io.evil.example/', 'https://user:password@words.atlee.io/display',
        'https://@words.atlee.io/', 'https://words.atlee.io:444/', 'https://words.atlee.io:80/',
        'https://words.atlee.io./', 'https://words.atlee.io@evil.example/', '/display',
        'javascript:alert(1)', 'data:text/html,hello', 'https://words.atlee.io\\@evil.example/',
        'https://words.atlee.io\n/', ' https://words.atlee.io/', null, undefined, {}]) {
        assert.equal(policy.isAllowed(url), false, String(url));
    }
});
test('16:9 surfaces preserve a 1440×810 child viewport', () => {
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
        for (const dpr of [1, 1.5, 2]) {
            const result = viewport.calculate(width, height, dpr, 0);
            assert.equal(result.logicalWidth, 1440);
            assert.equal(result.logicalHeight, 810);
            assert.equal(result.width, width);
            assert.equal(result.height, height);
            assert.equal(result.left, 0);
            assert.equal(result.top, 0);
        }
    }
});
test('non-16:9 letterboxes predictably without stretching', () => {
    const result = viewport.calculate(1920, 1000, 1, 2);
    assert.equal(result.height, 1000);
    assert.ok(result.left > 0);
    assert.equal(result.top, 0);
    assert.ok(Math.abs(result.width / result.height - 16 / 9) < 1e-10);
    const tall = viewport.calculate(1280, 800, 1, 0);
    assert.equal(tall.top, 40);
});
test('optional small bleed and invalid surface handling', () => {
    const result = viewport.calculate(1920, 1080, 2, 2);
    assert.ok(result.left < 0 && result.left > -2);
    assert.equal(result.top, -1);
    assert.equal(viewport.calculate(0, 1080, 1), null);
    assert.equal(viewport.calculate(Infinity, 1080, 1), null);
    assert.equal(viewport.calculate(1920, NaN, 1), null);
});
