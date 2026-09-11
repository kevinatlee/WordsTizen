(function (root) {
    'use strict';
    function calculate(width, height, devicePixelRatio, bleedPixels) {
        if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;
        var ratio = isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
        // Default to no cropping. Optional bleed is in compositor pixels, not panel pixels.
        var bleed = isFinite(bleedPixels) && bleedPixels > 0 ? Math.min(bleedPixels, 2) / ratio : 0;
        var scale = Math.min(width / 1440, height / 810);
        // Only bleed a matching 16:9 surface; keep intentional letterboxing intact.
        if (Math.abs(width / height - 16 / 9) < 0.001) {
            scale = Math.max((width + 2 * bleed) / 1440, (height + 2 * bleed) / 810);
        }
        return { logicalWidth: 1440, logicalHeight: 810, scale: scale,
            width: 1440 * scale, height: 810 * scale,
            left: (width - 1440 * scale) / 2, top: (height - 810 * scale) / 2 };
    }
    var viewport = { calculate: calculate };
    if (typeof module !== 'undefined' && module.exports) module.exports = viewport;
    else root.WordsViewport = viewport;
}(typeof window !== 'undefined' ? window : this));
