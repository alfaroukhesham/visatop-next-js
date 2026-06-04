/** Inlined before React hydrates (see app/layout.tsx). */
export const BFCACHE_BOOTSTRAP_SCRIPT = `
(function () {
  var LEFT = "visatop:left-page";
  var RETRY = "visatop:back-retry";
  var RESTORE = "visatop:bfcache-restore";
  var HOME = "__visatopReloadHomeCatalog";
  function markLeft() {
    try { sessionStorage.setItem(LEFT, "1"); } catch (e) {}
  }
  function tryHomeReload(attempt) {
    try {
      if (sessionStorage.getItem(LEFT) !== "1") return;
      var fn = window[HOME];
      if (typeof fn === "function") {
        fn();
        return;
      }
      if ((attempt || 0) >= 120) return;
      requestAnimationFrame(function () {
        tryHomeReload((attempt || 0) + 1);
      });
    } catch (e) {}
  }
  function dispatchRestore() {
    try {
      window.dispatchEvent(new Event(RESTORE));
      tryHomeReload(0);
    } catch (e) {}
  }
  function isBackForwardNav() {
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      return nav && nav.type === "back_forward";
    } catch (e) {
      return false;
    }
  }
  function onShow(e) {
    try {
      var left = sessionStorage.getItem(LEFT) === "1";
      var retried = sessionStorage.getItem(RETRY) === "1";
      var persisted = !!(e && e.persisted);
      var isBack = isBackForwardNav();
      try { sessionStorage.removeItem("visatop:leaving"); } catch (err) {}
      if (!left && !persisted && !isBack) return;
      if (persisted) {
        dispatchRestore();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (typeof window[HOME] === "function") {
            try { sessionStorage.removeItem(RETRY); } catch (err) {}
            dispatchRestore();
            return;
          }
          if (!retried) {
            try { sessionStorage.setItem(RETRY, "1"); } catch (err) {}
            window.location.reload();
            return;
          }
          try { sessionStorage.removeItem(RETRY); } catch (err) {}
          dispatchRestore();
        });
      });
    } catch (err) {}
  }
  window.addEventListener("pagehide", markLeft, true);
  document.addEventListener("freeze", markLeft, true);
  window.addEventListener("pageshow", onShow, true);
})();
`;
