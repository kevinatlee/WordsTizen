'use strict';
// An explicit file list prevents tests, secrets and development tools entering the widget.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist', 'Words');
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (fs.existsSync(destination)) {
    throw new Error('dist/Words already exists. Remove that generated folder before staging again.');
}
for (const file of ['config.xml', 'index.html', 'css/app.css', 'js/app.js',
    'js/url-policy.js', 'js/viewport.js', 'assets/icon.png']) {
    const output = path.join(destination, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(root, file), output);
}
console.log('Staged runtime files in dist/Words. Next: tizen build-web -- dist/Words');
