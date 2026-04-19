(function () {
  const isAdUrl = (u) => {
    if (!u) return false;
    const s = String(u);
    return /(banners\.tibiabr|premiumads|doubleclick|googlesyndication|adservice\.google|popunder|popads)/i.test(s);
  };

  const origOpen = window.open;
  window.open = function (url, target, features) {
    if (isAdUrl(url)) return null;
    return origOpen.apply(this, arguments);
  };

  document.addEventListener(
    "click",
    function (e) {
      const a = e.target && e.target.closest ? e.target.closest("a,ins") : null;
      if (!a) return;
      const href = a.getAttribute && a.getAttribute("href");
      if (isAdUrl(href) || a.matches("ins[data-revive-zoneid], ins[data-revive-id]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
