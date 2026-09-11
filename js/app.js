(function () {
    'use strict';
    var DEBUG = false; // Enable locally, or call WordsApp.diagnostics() in Web Inspector.
    var EDGE_BLEED_PIXELS = 0; // Set to 2 only if device testing reveals a seam.
    var LOAD_TIMEOUT_MS = 30000;
    var surface = document.getElementById('surface');
    var loading = document.getElementById('loading');
    var errorPanel = document.getElementById('error');
    var retry = document.getElementById('retry');
    var frame = null;
    var timer = null;
    var state = 'loading';
    var stopped = false;
    var layout = null;

    function warn(error) { console.warn('[Words] Platform API:', error && (error.message || error.name) || error); }
    function screenSaver(enabled, done) {
        var complete = done || function () {};
        try {
            var api = window.webapis && window.webapis.appcommon;
            if (!api || !api.setScreenSaver) { complete(); return; }
            api.setScreenSaver(enabled ? api.AppCommonScreenSaverState.SCREEN_SAVER_ON :
                api.AppCommonScreenSaverState.SCREEN_SAVER_OFF, complete, function (error) {
                    warn(error); complete();
                });
        } catch (error) { warn(error); complete(); }
    }
    function updateScreenSaver() {
        screenSaver(stopped || document.hidden || state === 'error');
    }
    function focusShell() {
        if (state === 'error') retry.focus();
        else document.body.focus();
    }
    function setState(next) {
        state = next;
        loading.hidden = next !== 'loading';
        errorPanel.hidden = next !== 'error';
        if (frame) frame.style.visibility = next === 'display' ? 'visible' : 'hidden';
        focusShell();
        updateScreenSaver();
    }
    function clearLoad() { window.clearTimeout(timer); timer = null; }
    function removeFrame() {
        if (frame) { frame.onload = null; frame.onerror = null; surface.removeChild(frame); frame = null; }
    }
    function showError() {
        if (stopped) return;
        clearLoad();
        removeFrame(); // A timed-out document cannot later replace the Retry screen.
        setState('error');
    }
    function resize() {
        layout = window.WordsViewport.calculate(window.innerWidth, window.innerHeight,
            window.devicePixelRatio, EDGE_BLEED_PIXELS);
        if (!layout || !frame) return;
        frame.style.left = layout.left + 'px';
        frame.style.top = layout.top + 'px';
        frame.style.transform = 'scale(' + layout.scale + ')';
    }
    function diagnostics() {
        var platform = 'unavailable';
        try {
            if (window.tizen && window.tizen.systeminfo) {
                platform = window.tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
            }
        } catch (error) { platform = 'unavailable'; }
        console.info('[Words] Viewport', {
            innerWidth: window.innerWidth, innerHeight: window.innerHeight,
            screenWidth: window.screen.width, screenHeight: window.screen.height,
            devicePixelRatio: window.devicePixelRatio, canvas: layout,
            rendered: frame ? { width: frame.getBoundingClientRect().width,
                height: frame.getBoundingClientRect().height } : null,
            platform: platform, userAgent: navigator.userAgent, state: state
        });
    }
    function loadWords() {
        if (stopped) return;
        clearLoad();
        removeFrame();
        if (navigator.onLine === false || !window.WordsUrlPolicy.isAllowed(window.WordsUrlPolicy.WORDS_URL)) {
            showError(); return;
        }
        setState('loading');
        var candidate = document.createElement('iframe');
        candidate.className = 'display';
        candidate.title = 'Words display';
        candidate.tabIndex = -1;
        // Preserve the site's origin/storage; deny top navigation, popups and downloads.
        candidate.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        candidate.setAttribute('scrolling', 'no');
        candidate.onload = function () {
            if (frame !== candidate || stopped || state !== 'loading') return;
            clearLoad();
            if (navigator.onLine === false) { showError(); return; }
            // Cross-origin load is NOT evidence of HTTP success or game readiness.
            setState('display');
            if (DEBUG) diagnostics();
        };
        candidate.onerror = function () { if (frame === candidate) showError(); };
        candidate.src = window.WordsUrlPolicy.WORDS_URL;
        frame = candidate;
        resize();
        timer = window.setTimeout(showError, LOAD_TIMEOUT_MS);
        surface.appendChild(candidate);
    }
    function exitApp() {
        if (stopped) return;
        stopped = true;
        clearLoad();
        var exited = false;
        var fallback;
        function finish() {
            if (exited) return;
            exited = true;
            window.clearTimeout(fallback);
            try {
                if (window.tizen && window.tizen.application) window.tizen.application.getCurrentApplication().exit();
                else { stopped = false; updateScreenSaver(); }
            } catch (error) { warn(error); stopped = false; updateScreenSaver(); }
        }
        // Give restoration its callback, but don't trap Back if the API never responds.
        fallback = window.setTimeout(finish, 500);
        screenSaver(true, finish);
    }
    document.addEventListener('keydown', function (event) {
        if (event.keyCode === 10009 || event.key === 'Escape') {
            event.preventDefault(); exitApp();
        } else if (event.keyCode === 13 || event.key === 'Enter') {
            event.preventDefault();
            if (state !== 'loading') loadWords();
        } else if (event.keyCode >= 37 && event.keyCode <= 40) {
            event.preventDefault(); focusShell();
        }
    });
    retry.addEventListener('click', loadWords);
    document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    document.addEventListener('dragstart', function (event) { event.preventDefault(); });
    window.addEventListener('resize', resize);
    window.addEventListener('offline', showError);
    window.addEventListener('online', function () { if (state === 'error' && !document.hidden) loadWords(); });
    document.addEventListener('visibilitychange', function () {
        updateScreenSaver();
        if (!document.hidden && !stopped) {
            focusShell(); resize();
            if (state === 'error' && navigator.onLine !== false) loadWords();
        }
    });
    window.addEventListener('blur', function () {
        // Keep remote events in the shell if a remote script attempts autofocus.
        window.setTimeout(function () {
            if (!stopped && !document.hidden && document.activeElement === frame) focusShell();
        }, 0);
    });
    window.addEventListener('pagehide', function () { screenSaver(true); });
    window.addEventListener('pageshow', updateScreenSaver);
    window.addEventListener('beforeunload', function () { screenSaver(true); });
    window.WordsApp = { diagnostics: diagnostics, retry: loadWords };
    loadWords();
}());
