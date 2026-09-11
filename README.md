# Words for Samsung TV

WordsTizen is a small **packaged Tizen Web Application** for [the Words display](https://words.atlee.io/display), the Samsung counterpart to [WordsTV](https://github.com/kevinatlee/WordsTV). Its launcher name is **Words**. Phones control the game; the television displays it. This repository contains only the wrapper, with no game/server copy or runtime dependencies.

Primary target: **Samsung UN75CU7000FXZC / 2023 CU7000**. Samsung lists 2023 TVs as Tizen 7.0 / Chromium M94. The wrapper declares Tizen 6.0 as its minimum and uses conservative JavaScript; other modern TVs/Smart Monitors may work, but neither this model nor broader compatibility has been tested on hardware. The remotely deployed game's browser requirements also apply. See [Samsung engine specifications](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html).

## Architecture and behavior

The packaged `index.html` remains the top-level document. A sandboxed remote iframe loads `/display`; only scripts and same-origin behavior are enabled. Samsung explicitly supports remote iframes but exposes Tizen/Product APIs only outside them; hosted applications cannot use Tizen APIs. The shell therefore owns screensaver control, loading/error UI, and Back. The emulator has documented remote-iframe limitations, so final verification requires a TV. See [Samsung iframe guidance](https://developer.samsung.com/smarttv/develop/getting-started/quick-start-guide.html) and [hosted application limitations](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html).

- **Layout:** the iframe stays 1440×810 CSS pixels. One uniform transform fits and centers it inside the measured outer viewport. Non-16:9 surfaces letterbox against navy; nothing stretches. The shell declares Samsung's recommended 1920-wide viewport. UHD TVs normally render applications at 1920×1080, not the physical panel's 3840×2160. Browser tests confirmed the child sees 1440×810 at four outer sizes. Physical Samsung output is still unverified. See [screen resolution guidance](https://developer.samsung.com/smarttv/develop/guides/fundamentals/managing-screen-resolution.html).
- **Edge bleed:** disabled by default because the Chromium preview had no seams. If hardware reveals a seam, set `EDGE_BLEED_PIXELS` in `js/app.js` to `2`. It adds a tiny proportional overscan on 16:9 surfaces only; units are compositor pixels adjusted by devicePixelRatio, not guaranteed physical panel pixels. Inspect all edges after enabling.
- **Keep awake:** the shell loads `$WEBAPIS/webapis/webapis.js` and calls `webapis.appcommon.setScreenSaver`. Loading/visible display disables the screensaver; hidden, error and exit states enable it. Resume reapplies the state. Missing APIs, exceptions and error callbacks are tolerated. This controls Samsung's screensaver, not TV sleep timers, energy settings or power-off policies. Forced termination may prevent cleanup callbacks. No artificial key activity is generated. See [AppCommon API](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/appcommon-api.html).
- **Remote:** Back (Samsung's documented key code 10009) exits directly. Enter activates Retry only while the error screen is shown; it does nothing while loading or displaying Words. Arrow keys keep focus in the shell. Standard keys need no registration, so no `tv.inputdevice` privilege is requested. Desktop Escape simulates Back. See [remote control keys](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html). Direct exit follows this private-sideload app's requirements; Samsung Store policy instead calls for a confirmation dialog on the home screen. See [termination guidance](https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html).

## Navigation and network policy

`js/url-policy.js` validates every shell-assigned URL: HTTPS, exact `words.atlee.io` hostname, absent/default or 443 port, no credentials. The shell never navigates itself to remote content. The iframe sandbox denies parent navigation and popups; CSP restricts frame sources to the Words HTTPS origin. There is no wildcard access, hosted `<tizen:content>`, or remote top-level navigation permission. TLS verification and mixed-content blocking remain enabled.

Unlike Android WebView, a cross-origin iframe provides no callback to inspect every internal URL or redirect. The URL utility protects shell assignments; sandbox/CSP provide the browser boundary. The parent cannot apply Android's exact URL predicate to every navigation the remote document initiates. The remote document also owns its subresource CSP; the shell's CSP does not rewrite that policy. Verify enforcement on the TV.

Only the Internet privilege is needed. External access allows `https://words.atlee.io` and `wss://words.atlee.io` for assets and Socket.IO polling/WebSocket transport. The hosted page also requests Cloudflare's analytics script from `https://static.cloudflareinsights.com`; this optional origin is deliberately omitted. Live Chromium testing with other external origins blocked still reached a connected room. No analytics are added by this wrapper. See [Samsung configuration guidance](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html).

### Live investigation — September 11, 2026

Results differ by client: Node HTTP probes received **404**, `Cannot GET /display`, with `Content-Security-Policy: default-src 'none'`. Actual Chrome browser navigation received **200** and the functioning game. The cause of this difference was not established; a command-line 404 alone is not evidence that the browser app is unavailable.

The successful browser response had no `X-Frame-Options`, CSP or CORS allow-origin header, and no Set-Cookie. The error response likewise had no X-Frame-Options or `frame-ancestors`; `default-src` does not substitute for `frame-ancestors`.

Inside the sandboxed shell, the live game executed JavaScript, loaded relative `/assets/` JS/CSS, displayed a room QR code and **Connected**, and received WebSocket data. It used `words:active-display-session` and reconnect entries in localStorage. No active service worker was observed. Core requests stayed on Words; Cloudflare challenge resources used `/cdn-cgi/`. Cookies were not observed as a requirement. TV storage/third-party-cookie behavior, Cloudflare handling and an actual phone-controlled round still need hardware testing.

### Loading and error limits

Navy loading UI disappears on iframe `load`, without an extra delay. That event **does not prove HTTP success, game readiness or realtime health**: browsers may fire it for HTTP errors or blocked frames and may suppress iframe `error`. The wrapper cannot read remote DOM/status. A 30-second missing-load timeout, offline events and any delivered error event show the focused Retry screen. Returning online or resuming from an error retries automatically. The game's own reconnect UI handles backend disconnects when the browser still reports online.

HTTP 404/500, TLS failures or frame-policy failures may therefore leave a remote error/blank page rather than the wrapper error screen. On the wrapper error screen, press Enter to retry. For a remote error/blank page, press Back to exit and relaunch Words. There is no opaque `no-cors` status guess and no runtime preflight, because the observed CORS headers do not permit a reliable one.

Optional future improvement, **not required or implemented here**: the hosted display could send an origin-checked `postMessage` readiness/health event. That would make readiness detection reliable. If framing policy changes, evaluate a narrow policy compatible with the actual packaged origin rather than globally weakening headers. No backend changes were made.

## Build, sign and install

Install [Tizen Studio with Samsung TV Extension and Samsung Certificate Extension](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html), including Web CLI/Web IDE. Use a Samsung **TV Web Application** project, not mobile, wearable or a hosted application. Import the repository using **File > Import > Tizen > Tizen project** ([Samsung import FAQ](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html)). The CLI below can build directly from `config.xml` without IDE import.

Node 18+ is optional for tests and clean staging; no `npm install` is needed for these commands:

```sh
npm test
npm run check
npm run stage
tizen build-web -- dist/Words
tizen package -t wgt -s YOUR_PROFILE -- dist/Words/.buildResult
```

Staging copies only the seven runtime files, excluding tests, documentation and credentials. For subsequent builds, remove the generated `dist/Words` folder before staging again. The Tizen build output is `dist/Words/.buildResult`; use the `.wgt` filename printed by the package command (normally `Words.wgt` for the staged project). `YOUR_PROFILE` is the profile you create locally. These build/package/install/run forms follow [Samsung's TV CLI documentation](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).

1. Connect PC and TV to the same network. Open Smart Hub > Apps and enter **12345**. Current firmware may place this under **Apps Settings**. Enable Developer mode, enter the development PC's IP, and reboot the TV. Follow [Samsung's TV device guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) for firmware-specific screens.
2. Open **Tools > Device Manager**, then Remote Device Manager; add the TV IP and connect. CLI alternative: `sdb connect TV_IP`, then `sdb devices`. Record the actual device serial from that output.
3. In **Tools > Certificate Manager**, create a **Samsung > TV** profile (or use your existing one). Sign in yourself, create/import an author certificate, and create a distributor certificate including this TV's DUID. Keep the author certificate backed up outside the repository. Use Device Manager's **Permit to install applications** action as directed by [Samsung's certificate guide](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
4. Run the build/package commands above, substituting your profile. Then install and launch, substituting the actual serial and generated filename:

```sh
tizen install -s TV_SERIAL --name Words.wgt -- dist/Words/.buildResult
tizen run -s TV_SERIAL -p WordsTizen.Words
```

The application ID is `WordsTizen.Words`; the package ID is `WordsTizen`. Launch **Words** from Apps/Home after installation. Certificate files, signatures, profiles and widgets are ignored by Git; never place signing secrets in source files.

**Environment limitation:** this implementation environment had neither Tizen CLI/SDB on PATH nor an SDK in the checked standard locations. No SDK validation, signed `.wgt`, installation or physical-TV run was performed. XML parsing, project invariants and browser testing are not substitutes for the SDK and TV checks above.

## Debugging and tests

With the connected TV selected in Tizen Studio, use **Debug As > Tizen Web Application** to open Web Inspector ([Samsung instructions](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/web-inspector.html)). In the top/local document console run `WordsApp.diagnostics()`. Alternatively set `DEBUG = true` in `js/app.js` before building for one log per iframe load. It reports outer/screen dimensions, DPR, logical/rendered canvas, scale, platform capability when available and user agent. Select the remote frame's inspector context separately to examine the game; the shell cannot read it programmatically.

`npm test` runs ten dependency-free Node tests for URL/viewport logic and simulated lifecycle/API behavior. `npm run check` validates JS syntax, local references, matching CSPs, manifest invariants and PNG dimensions. The XML files were also parsed with PowerShell's XML parser during implementation.

An optional integration script uses a locally available Playwright package and installed Chrome:

```sh
node tests/browser.cjs
node tests/browser.cjs --live
npm run probe
```

The default browser test uses a labeled fixture and mocked TV APIs; it verifies actual iframe dimensions at 1280×720, 1920×1080, 3840×2160 and 1920×1000, scripts, relative assets, localStorage, sandboxing, Retry and Back. `--live` additionally opens the hosted display and may create a temporary game room. Screenshots go into ignored `test-results/`. The HTTP probe prints selected headers and returns nonzero for non-2xx; it is developer-only and can differ from browser results as described above. Playwright is not a runtime or mandatory test dependency.

## Manual TV checklist

- [ ] Appears as **Words** in Apps/Home and launches fullscreen without a white flash.
- [ ] `/display` creates/reconnects a room; QR code and all UI fit like WordsTV.
- [ ] No scrollbars, edge seams, stretched layout or meaningful cropping.
- [ ] Phone controllers join and a full round updates the TV in realtime.
- [ ] Screensaver stays off during a long active display session; normal behavior resumes after Home/Back.
- [ ] Home/resume preserves or reconnects the room and reapplies screensaver state.
- [ ] Back exits from both the display and the error screen.
- [ ] Network disconnect gives sensible shell/game failure behavior; Retry is focused and Enter works.
- [ ] Reconnecting restores the display; Enter leaves the active display unchanged; exit and relaunch if a remote error persists without an offline event.
- [ ] Web Inspector confirms a 1440×810 child viewport and no required blocked resources.

## Files and reference

`config.xml` / `.project` describe the TV project; `index.html`, `css/app.css` and `js/` implement the wrapper. `assets/icon.png` is the 117×117 developer icon, adapted directly from WordsTV's vector paths; `assets/icon.svg` retains editable source. Samsung distinguishes this developer icon from Store artwork ([icon FAQ](https://developer.samsung.com/smarttv/design/smart-tv-application-design-qa.html)). No Store submission assets are required here.

Reference inspected read-only: WordsTV commit `b2cbdef46ea7fc515faca93b7c3ddf1503dce403`, including README, MainActivity, TvViewportNormalizer, UrlPolicy, AndroidManifest and launcher/color/string resources. The initial port preserves the WordsTizen repository's original history and LICENSE.

### CU7000 release-readiness review

The runtime JavaScript uses classic scripts and ES5 syntax with established DOM/URL APIs; no optional chaining, nullish coalescing, module loading, async functions or newer Array/Object helpers are required on the TV. CSS uses features available before Chromium M94. Modern Node/Playwright syntax in `scripts/` and `tests/` runs only on the development PC and is excluded from the widget. The declared installation floor remains Tizen **6.0**; the primary compatibility target is **Tizen 7.0 / Chromium M94**, not a newer firmware requirement. This is a source/API audit, not execution in an M94 engine or on Samsung hardware.

The 1920×1080 layout produces scale `1.3333333333333333` without stretching or cropping at the default zero bleed. The Product API script, screensaver lifecycle, minimal sandbox and Internet-only privilege remain unchanged after review. The live integration check now fails if HTTP 200, a connected room, reconnect storage, the 1440×810 viewport or received WebSocket data is missing; a timeout is no longer silently accepted. Physical-TV checklist items above remain outstanding.

**Hosted-game compatibility concern (source fix implemented; deployment pending):** the inspected production stylesheet (`/assets/index-DnW0eB39.css`) uses `min-height: calc(100dvh - 4.75rem)` on `.display-room-page` and `width: min(55vw, 44rem, calc(100dvh - 8.75rem))` on `.display-puzzle-panel`, without equivalent `vh` fallbacks. Dynamic viewport units arrived in [Chrome 108](https://web.dev/blog/viewport-units), so M94 ignores these declarations. The iframe still has the correct viewport, but the game's internal sizing can differ. Modern Chrome success therefore does not establish complete CU7000 visual compatibility. The hosted JavaScript also uses `Array.prototype.at`, which [shipped in Chrome 92](https://v8.dev/blog/v8-release-92) and is within the M94 target, though not the wrapper's older declared installation floor.

The neighboring Words source repository now includes equivalent `100vh` declarations immediately before both `100dvh` declarations in `apps/client/src/styles.css`, on the focused `codex/tv-viewport-fallbacks` branch. A fullscreen iframe has no retracting browser chrome, making `vh` an appropriate fallback. This cannot be repaired by the cross-origin parent without changing architecture or compromising isolation; only the canonical frontend stylesheet and its development log were changed separately; production has not been deployed. Treat the wrapper as ready for integration and TV testing, with final M94 visual release approval pending deployment of the source fix and a satisfactory device test.

As a targeted diagnostic, removing only those unsupported declarations in a disposable modern-Chrome session at 1440×810 increased document height from 810 to 838 pixels and puzzle width from 670 to approximately 1160 pixels. This is not a full M94 emulation, but demonstrates a real sizing/clipping risk rather than merely an unused unsupported feature.
