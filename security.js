'use strict';
// Validation only. MAIN-world page messages are not an authentication boundary.
globalThis.MMSecurity = Object.freeze({
  tabId: value => Number.isSafeInteger(value) && value >= 0,
  tabIds: value => Array.isArray(value) && value.length <= 128 &&
    value.every(id => Number.isSafeInteger(id) && id >= 0) && new Set(value).size === value.length,
  callUrl(value, includeDirect = false) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.port &&
        ['www.facebook.com', 'www.messenger.com'].includes(url.hostname) &&
        (includeDirect ? /(?:^|\/)(?:groupcall|call)(?:\/|$)/i : /(?:^|\/)groupcall(?:\/|$)/i).test(url.pathname);
    } catch { return false; }
  },
  signal(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.type === 'offer' || value.type === 'answer') {
      return typeof value.sdp === 'string' && value.sdp.length > 0 && value.sdp.length <= 131072
        ? { type: value.type, sdp: value.sdp } : null;
    }
    const c = value.candidate;
    if (value.type !== 'candidate' || !c || typeof c !== 'object' ||
        typeof c.candidate !== 'string' || c.candidate.length > 8192 ||
        !(c.sdpMid == null || (typeof c.sdpMid === 'string' && c.sdpMid.length <= 256)) ||
        !(c.sdpMLineIndex == null || (Number.isSafeInteger(c.sdpMLineIndex) && c.sdpMLineIndex >= 0 && c.sdpMLineIndex <= 128)) ||
        !(c.usernameFragment == null || (typeof c.usernameFragment === 'string' && c.usernameFragment.length <= 256))) return null;
    return { type: 'candidate', candidate: {candidate: c.candidate, sdpMid: c.sdpMid ?? null,
      sdpMLineIndex: c.sdpMLineIndex ?? null, usernameFragment: c.usernameFragment ?? null} };
  },
  text(value) {
    return String(value ?? '').slice(0, 2048)
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/(?:gh[pousr]_[\w]+|github_pat_[\w]+)/g, '[token]')
      .replace(/[\u0000-\u001f\u007f]/g, ' ');
  }
});
