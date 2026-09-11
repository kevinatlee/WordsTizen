(function (root) {
    'use strict';
    function isAllowed(value) {
        // Reject syntax that URL() normalizes, including empty userinfo and backslashes.
        if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
        if (!/^https:\/\/words\.atlee\.io(?::443)?(?:[/?#]|$)/i.test(value)) return false;
        try {
            var url = new URL(value);
            return url.protocol === 'https:' && url.hostname === 'words.atlee.io' &&
                (url.port === '' || url.port === '443') && !url.username && !url.password;
        } catch (error) { return false; }
    }
    var policy = { WORDS_URL: 'https://words.atlee.io/display', isAllowed: isAllowed };
    if (typeof module !== 'undefined' && module.exports) module.exports = policy;
    else root.WordsUrlPolicy = policy;
}(typeof window !== 'undefined' ? window : this));
