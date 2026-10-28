/**
 * Inline JS that injects a third-party script only after the first user interaction
 * (pointer/key/touch/scroll) or, if none happens, once the page has loaded and an
 * idle fallback (~3.5s) passes. Keeps GTM/gtag and Meta Pixel off the main thread
 * during boot (Lighthouse TBT). Callers must define their own queue stubs first
 * (dataLayer/gtag, fbq) so events fired before the script arrives are not lost.
 */
export const DEFERRED_SCRIPT_IDLE_FALLBACK_MS = 3500;

export const buildDeferredScriptLoader = (input: {
  src: string;
  id: string;
  fallbackMs?: number;
}): string => {
  const fallbackMs = input.fallbackMs ?? DEFERRED_SCRIPT_IDLE_FALLBACK_MS;
  return `
(function(){
  var done = false;
  var events = ['pointerdown','keydown','touchstart','scroll'];
  function load(){
    if (done) return; done = true;
    for (var i = 0; i < events.length; i++) window.removeEventListener(events[i], load, true);
    if (document.getElementById(${JSON.stringify(input.id)})) return;
    var s = document.createElement('script');
    s.id = ${JSON.stringify(input.id)}; s.async = true; s.src = ${JSON.stringify(input.src)};
    document.head.appendChild(s);
  }
  for (var i = 0; i < events.length; i++) window.addEventListener(events[i], load, { capture: true, passive: true, once: true });
  function idle(){
    setTimeout(function(){
      if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 });
      else load();
    }, ${fallbackMs});
  }
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
})();
`.trim();
};
