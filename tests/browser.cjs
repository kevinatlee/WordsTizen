'use strict';
// Optional integration check: supply Playwright locally; no browser dependency ships in Words.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.includes('$WEBAPIS')) {
            res.setHeader('Content-Type', 'application/javascript'); res.end(''); return;
        }
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404); res.end(); return;
        }
        res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' :
            file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
        res.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            if (window.top !== window) return;
            window.saverCalls = []; window.exits = 0;
            window.webapis = { appcommon: { AppCommonScreenSaverState: { SCREEN_SAVER_ON: 1, SCREEN_SAVER_OFF: 0 },
                setScreenSaver(value, success) { window.saverCalls.push(value); success(); } } };
            window.tizen = { application: { getCurrentApplication() { return { exit() { window.exits++; } }; } } };
        });
        await context.route('https://words.atlee.io/**', route => {
            if (route.request().url().endsWith('/fixture.js')) {
                return route.fulfill({ contentType: 'application/javascript', body:
                    'localStorage.setItem("fixture", "ok"); document.body.dataset.ready = "yes";' });
            }
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>html,body { margin:0; background:#10172a; color:white; font:32px Arial; }
                body { box-sizing:border-box; width:100vw; height:100vh; border:2px solid #4676f2; }
                h1 { margin:100px; }</style></head><body><h1>Words wrapper test fixture</h1>
                <script src="/fixture.js"></script></body></html>` });
        });
        const url = 'http://127.0.0.1:' + server.address().port + '/';
        await page.goto(url);
        await page.waitForFunction(() => document.querySelector('iframe').style.visibility === 'visible');
        const frame = page.frames().find(f => f.url().startsWith('https://words.atlee.io'));
        assert.ok(frame);
        assert.deepEqual(await frame.evaluate(() => [innerWidth, innerHeight, document.body.dataset.ready,
            localStorage.getItem('fixture')]), [1440, 810, 'yes', 'ok']);
        for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160], [1920, 1000]]) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(([w, h]) => {
                const r = document.querySelector('iframe').getBoundingClientRect();
                return Math.abs(r.width - 1440 * Math.min(w / 1440, h / 810)) < 0.1;
            }, [width, height]);
            assert.deepEqual(await frame.evaluate(() => [innerWidth, innerHeight]), [1440, 810]);
        }
        const before = page.url();
        const topBlocked = await frame.evaluate(() => {
            try { top.location.href = 'https://evil.example/'; return false; } catch (_) { return true; }
        });
        assert.equal(topBlocked, true); assert.equal(page.url(), before);
        assert.equal(await frame.evaluate(() => window.open('https://evil.example/')), null);
        await page.setViewportSize({ width: 1920, height: 1080 });
        fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'test-results/fixture.png') });
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        assert.equal(await page.locator('#error').isVisible(), true);
        assert.equal(await page.locator('#retry').evaluate(el => el === document.activeElement), true);
        await page.screenshot({ path: path.join(root, 'test-results/error.png') });
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('iframe').style.visibility === 'visible');
        await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 10009, bubbles: true })));
        assert.equal(await page.evaluate(() => window.exits), 1);
        assert.equal(await page.evaluate(() => window.saverCalls.at(-1)), 1);
        assert.deepEqual(errors, []);
        console.log('Chromium: 1440×810 child viewport, four surfaces, scripts/relative assets/storage, sandbox, Retry and Back passed.');
        if (!process.argv.includes('--live')) return;
        // Opt-in: opening the real display may create a temporary Words room.
        const live = await browser.newContext();
        await live.route('**/*', route => {
            const host = new URL(route.request().url()).hostname;
            return host === 'words.atlee.io' || host === '127.0.0.1' ? route.continue() : route.abort();
        });
        const livePage = await live.newPage();
        const requests = new Set();
        const sockets = [];
        let receivedFrames = 0;
        livePage.on('request', req => requests.add(req.url()));
        livePage.on('websocket', ws => {
            sockets.push(ws.url());
            ws.on('framereceived', () => receivedFrames++);
        });
        const response = await livePage.goto('https://words.atlee.io/display');
        assert.equal(response.status(), 200, 'The browser must receive the live display');
        console.log('Live browser response:', response.status(), (await livePage.locator('body').innerText()).slice(0, 100));
        const headers = await response.allHeaders();
        for (const name of ['x-frame-options', 'content-security-policy', 'access-control-allow-origin', 'set-cookie']) {
            console.log(name, name === 'set-cookie' && headers[name] ? '(present)' : headers[name] || '(absent)');
        }
        await livePage.goto(url);
        await livePage.waitForFunction(() => document.querySelector('iframe').style.visibility === 'visible');
        const liveFrame = livePage.frames().find(f => f.url().startsWith('https://words.atlee.io'));
        assert.ok(liveFrame, 'The live Words iframe must exist');
        if (liveFrame) {
            await liveFrame.waitForSelector('body');
            await liveFrame.waitForFunction(() => document.body.innerText.includes('Connected') &&
                document.body.innerText.includes('https://words.atlee.io/join/') &&
                !!localStorage.getItem('words:active-display-session'), null, { timeout: 15000 });
            assert.deepEqual(await liveFrame.evaluate(() => [innerWidth, innerHeight]), [1440, 810]);
            console.log('Live iframe:', await liveFrame.evaluate(() => ({ width: innerWidth, height: innerHeight,
                connected: document.body.innerText.includes('Connected'),
                hasJoinLink: document.body.innerText.includes('https://words.atlee.io/join/'),
                hasDisplaySession: !!localStorage.getItem('words:active-display-session'),
                serviceWorker: !!(navigator.serviceWorker && navigator.serviceWorker.controller) })));
            await livePage.screenshot({ path: path.join(root, 'test-results/live.png') });
        }
        console.log('Live request origins:', [...new Set([...requests].map(value => new URL(value).origin))]);
        console.log('Live WebSocket origins:', [...new Set(sockets.map(value => new URL(value).origin))]);
        console.log('Live WebSocket frames received:', receivedFrames);
        assert.ok(receivedFrames > 0, 'The live display must receive WebSocket data');
        await live.close();
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
