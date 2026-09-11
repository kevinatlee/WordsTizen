'use strict';
// Developer-only HTTP inspection; never shipped in the widget, never bypasses CORS/TLS.
(async function () {
    const response = await fetch('https://words.atlee.io/display', {
        redirect: 'manual', headers: { Origin: 'null' }, signal: AbortSignal.timeout(15000)
    });
    console.log('Status:', response.status);
    for (const header of ['location', 'content-type', 'x-frame-options', 'content-security-policy',
        'access-control-allow-origin', 'access-control-allow-credentials', 'set-cookie']) {
        // Don't print cookie values if the deployment adds a session in future.
        const value = response.headers.get(header);
        console.log(header + ':', header === 'set-cookie' && value ? '(present; redacted)' : value || '(absent)');
    }
    const body = await response.text();
    console.log('Asset references:', [...body.matchAll(/(?:src|href)=["']([^"']+)/g)].map(m => m[1]));
    console.log('Cannot GET /display:', body.includes('Cannot GET /display'));
    if (!response.ok) process.exitCode = 1;
}()).catch(error => { console.error(error.message); process.exitCode = 1; });
