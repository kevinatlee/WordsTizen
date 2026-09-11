'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of ['app.js', 'viewport.js', 'url-policy.js']) {
    new vm.Script(read('js/' + file), { filename: file });
}
const xml = read('config.xml');
const html = read('index.html');
const policy = xml.match(/<tizen:content-security-policy>([^<]+)</)[1];
assert.equal(policy, html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]);
assert.match(xml, /<content src="index.html"\/>/);
assert.match(xml, /<name>Words<\/name>/);
assert.match(xml, /package="[A-Za-z0-9]{10}"/);
assert.match(xml, /profile name="tv-samsung"/);
assert.equal((xml.match(/<tizen:privilege /g) || []).length, 1);
assert.match(xml, /privilege\/internet/);
assert.ok(!xml.includes('origin="*"') && !xml.includes('allow-navigation'));
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!match[1].startsWith('$WEBAPIS/')) assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
}
const png = fs.readFileSync(path.join(root, 'assets/icon.png'));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
assert.equal(png.readUInt32BE(16), 117);
assert.equal(png.readUInt32BE(20), 117);
console.log('JavaScript syntax, runtime references, CSP consistency, manifest invariants and 117×117 PNG passed.');
console.log('This is not Tizen SDK/schema validation.');
