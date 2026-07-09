/**
 * bug-reporter.js — client-side error capture (vanilla-JS port of the bugfix-kit
 * React reporter). Catches window errors, unhandled rejections, and intercepted
 * console.error/warn, batches them, and POSTs to the app's own server, which
 * forwards to BUG_LRS as xAPI `failed` statements.
 *
 * Invariants (do not regress):
 *   - NEVER crashes the app: every path is wrapped in try/catch.
 *   - '[BugReporter]' loop guard: our own logs are skipped by the console
 *     interceptor so reporting an error can't self-feed an infinite loop.
 *   - No BUG_LRS credentials here — the client talks only to its own server.
 *   - Auth token attached best-effort (report is public; token just enriches actor).
 *
 * Exposes window.BugReporter = { reportError, reportCaughtError }. Auto-inits on load.
 */
(function () {
  'use strict';
  if (window.__bugReporterInstalled) return; // idempotent
  window.__bugReporterInstalled = true;

  var ENDPOINT = '/api/telemetry/bug-report';
  var PREFIX = '[BugReporter]';
  var DEDUP_TTL = 60000;   // 1 min
  var MAX_QUEUE = 20;
  var FLUSH_INTERVAL = 3000;

  var recentErrors = new Map();
  var queue = [];

  function token() {
    try { if (window.Auth && typeof Auth.getToken === 'function') return Auth.getToken(); } catch (_) {}
    return null;
  }

  function sendReport(report) {
    try {
      var headers = { 'Content-Type': 'application/json' };
      var t = token();
      if (t) headers['Authorization'] = 'Bearer ' + t;
      fetch(ENDPOINT, {
        method: 'POST', headers: headers, credentials: 'same-origin',
        body: JSON.stringify(report),
      }).catch(function () { /* never let reporting crash the app */ });
    } catch (_) { /* swallow */ }
  }

  function flushBeacon() {
    if (queue.length === 0 || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    var batch = queue.splice(0, MAX_QUEUE);
    for (var i = 0; i < batch.length; i++) {
      try {
        var blob = new Blob([JSON.stringify(batch[i])], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
      } catch (_) { /* swallow */ }
    }
  }

  function flush() {
    if (queue.length === 0) return;
    var batch = queue.splice(0, MAX_QUEUE);
    for (var i = 0; i < batch.length; i++) sendReport(batch[i]);
  }

  function enqueue(report) {
    try {
      var key = (report.source || 'client') + ':' + report.message + ':' + (report.component || report.route || '');
      var now = Date.now();
      if (recentErrors.has(key) && (now - recentErrors.get(key)) < DEDUP_TTL) return;
      recentErrors.set(key, now);
      if (queue.length >= MAX_QUEUE) return; // drop if flooded
      queue.push(report);
    } catch (_) { /* swallow */ }
  }

  function baseContext(extra) {
    var ctx = { userAgent: navigator.userAgent, url: window.location.href, timestamp: new Date().toISOString() };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) ctx[k] = extra[k];
    return ctx;
  }

  function reportError(params) {
    params = params || {};
    enqueue({
      source: 'client',
      message: params.message,
      stack: params.stack,
      component: params.component,
      route: window.location.pathname,
      severity: params.severity || 'error',
      context: baseContext(params.context),
    });
  }

  function reportCaughtError(error, component, context) {
    reportError({
      message: (error && error.message) || String(error),
      stack: error && error.stack,
      component: component,
      severity: 'error',
      context: context,
    });
  }

  function init() {
    // Global JS errors
    window.addEventListener('error', function (e) {
      enqueue({
        source: 'client',
        message: (e && e.message) || 'Unknown error',
        stack: e && e.error && e.error.stack,
        route: window.location.pathname,
        severity: 'error',
        context: baseContext({ filename: e && e.filename, lineno: e && e.lineno, colno: e && e.colno }),
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', function (e) {
      var reason = e && e.reason;
      var message = (reason instanceof Error) ? reason.message : String(reason || 'Unhandled promise rejection');
      enqueue({
        source: 'client',
        message: message,
        stack: (reason instanceof Error) ? reason.stack : undefined,
        route: window.location.pathname,
        severity: 'error',
        context: baseContext({ type: 'unhandledrejection' }),
      });
    });

    // Intercept console.error / warn so caught errors also reach BUG_LRS.
    ['error', 'warn'].forEach(function (method) {
      var original = console[method];
      console[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        original.apply(console, args);
        try {
          var firstStr = (typeof args[0] === 'string') ? args[0] : '';
          if (firstStr.indexOf(PREFIX) === 0) return; // loop guard
          var first = args[0];
          var message, stack;
          if (first instanceof Error) { message = first.message; stack = first.stack; }
          else {
            message = args.map(function (a) {
              if (a instanceof Error) return a.message;
              if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (_) { return String(a); } }
              return String(a);
            }).join(' ');
            var errArg = args.find(function (a) { return a instanceof Error; });
            stack = errArg && errArg.stack;
          }
          if (message) {
            enqueue({
              source: 'client',
              message: String(message).substring(0, 1000),
              stack: stack,
              route: window.location.pathname,
              severity: method === 'warn' ? 'warning' : 'error',
              context: baseContext({ type: 'console.' + method }),
            });
          }
        } catch (_) { /* never let interception crash the app */ }
      };
    });

    setInterval(flush, FLUSH_INTERVAL);
    window.addEventListener('pagehide', flushBeacon);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushBeacon();
    });
    setInterval(function () {
      var now = Date.now();
      recentErrors.forEach(function (ts, key) { if (now - ts > DEDUP_TTL) recentErrors.delete(key); });
    }, DEDUP_TTL);
  }

  window.BugReporter = { reportError: reportError, reportCaughtError: reportCaughtError };
  init();
})();
