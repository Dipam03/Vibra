/* Vibra PWA v3.1: independent of the Supabase/login module.
   Loaded synchronously in the page head so beforeinstallprompt is not missed. */
(() => {
  'use strict';
  let deferredPrompt = null;
  let isPrompting = false;
  let registration = null;
  const sheetId = 'vibra-install-sheet';
  const isIOS = () => /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true;
  const isLocalDev = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const secureHost = () => location.protocol === 'https:' || (location.protocol === 'http:' && isLocalDev());

  function hideGuide() {
    const sheet = document.getElementById(sheetId);
    if (sheet) sheet.remove();
    document.removeEventListener('keydown', escListener);
  }
  function escListener(event) { if (event.key === 'Escape') hideGuide(); }
  function steps() {
    if (isStandalone()) return {
      title: 'Vibra is installed',
      intro: 'Vibra is already open in app mode. You can open it from your home screen.',
      items: [],
    };
    if (!secureHost()) return {
      title: 'Open your hosted Vibra website',
      intro: 'Installation works on HTTPS websites (and localhost for development), not a downloaded HTML file or an ordinary HTTP link.',
      items: [
        'Upload all files to your GitHub Pages repository, including manifest.webmanifest, sw.js, pwa.js and the assets folder.',
        'Open your public https://…github.io/… site in Chrome or Safari.',
        'Tap Install Vibra again.'
      ],
    };
    if (isIOS()) return {
      title: 'Install Vibra on iPhone / iPad',
      intro: 'Apple requires the Home Screen install step in the browser; a website cannot start this permission dialog automatically.',
      items: [
        'Open Vibra in Safari. (On supported iOS versions, the Share menu in other browsers may also work.)',
        'Tap the Share icon (square with upward arrow).',
        'Choose Add to Home Screen.',
        'If shown, enable Open as Web App, then tap Add.'
      ],
    };
    if (isAndroid()) return {
      title: 'Install Vibra on Android',
      intro: 'Your browser has not offered its one-tap install prompt yet. You can still use the browser menu to add Vibra.',
      items: [
        'Open the live HTTPS Vibra link in Google Chrome (not in Instagram/WhatsApp in-app browser).',
        'Tap the three-dot menu (⋮) at the top right.',
        'Tap Install app or Add to Home screen (wording varies by browser).',
        'Confirm Install. If only Create shortcut is available, Chrome is not offering a full app installation yet.'
      ],
    };
    return {
      title: 'Install Vibra',
      intro: 'This browser has not provided an installation prompt for Vibra.',
      items: [
        'Open the live HTTPS website in Chrome or Microsoft Edge.',
        'Open the browser menu and choose Install Vibra / Install app (or look for the install icon in the address bar).',
        'If the option is missing, check the installed site status below and try refreshing.'
      ],
    };
  }
  function showGuide(message = '') {
    hideGuide();
    const guide = steps();
    const root = document.createElement('div');
    root.id = sheetId;
    root.className = 'vibra-install-backdrop';
    root.innerHTML = `
      <section class="vibra-install-panel" role="dialog" aria-modal="true" aria-labelledby="vibra-install-title">
        <button class="vibra-install-close" type="button" aria-label="Close install instructions" data-pwa-close>×</button>
        <div class="vibra-install-app-row">
          <img src="./assets/icon-192.png" alt="Vibra app icon" width="64" height="64" />
          <div><strong>Vibra</strong><span>Social web app · Black / white / red</span></div>
        </div>
        <h2 id="vibra-install-title">${guide.title}</h2>
        <p>${message || guide.intro}</p>
        ${guide.items.length ? `<ol class="vibra-install-steps">${guide.items.map((item) => `<li>${item}</li>`).join('')}</ol>` : ''}
        <div class="vibra-install-check" id="vibra-install-check" aria-live="polite">Checking installation setup…</div>
        <div class="vibra-install-actions">
          <button type="button" class="vibra-install-secondary" data-pwa-close>Got it</button>
          <button type="button" class="vibra-install-primary" data-pwa-retry>Try installing</button>
        </div>
      </section>`;
    // The content above is static app-owned guidance, never sourced from user text.
    root.addEventListener('click', (event) => {
      if (event.target === root || event.target.closest('[data-pwa-close]')) hideGuide();
      else if (event.target.closest('[data-pwa-retry]')) { hideGuide(); void open(); }
    });
    document.body.appendChild(root);
    document.addEventListener('keydown', escListener);
    root.querySelector('[data-pwa-close]')?.focus();
    void diagnostic(root.querySelector('#vibra-install-check'));
  }
  async function diagnostic(node) {
    if (!node) return;
    const checks = [`${secureHost() ? '✓' : '✕'} HTTPS / localhost`];
    try {
      const response = await fetch(new URL('./manifest.webmanifest', location.href), {cache: 'no-store'});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      checks.push(`${manifest.name && manifest.start_url && manifest.display === 'standalone' ? '✓' : '✕'} Web app manifest`);
      const paths = new Set((manifest.icons || []).flatMap((icon) => (icon.sizes || '').split(' ')));
      checks.push(`${paths.has('192x192') && paths.has('512x512') ? '✓' : '✕'} App icons (192 / 512)`);
    } catch { checks.push('✕ Manifest not accessible on this website'); }
    checks.push(`${registration || navigator.serviceWorker?.controller ? '✓' : '…'} Service worker`);
    node.textContent = checks.join('  ·  ');
  }
  async function open() {
    if (isPrompting) return;
    if (isStandalone()) { showGuide(); return; }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null; // Each event can be used only once.
      isPrompting = true;
      try {
        // Keep prompt() in the synchronous user-click call chain.
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          hideGuide();
          // The install completes later; `appinstalled` confirms it.
          console.info('Vibra: browser installation accepted');
        } else {
          showGuide('Installation was dismissed. You can try again from your browser menu.');
        }
      } catch (err) {
        console.warn('Vibra: native install prompt unavailable:', err);
        showGuide();
      } finally { isPrompting = false; }
      return;
    }
    // Some new Chromium versions expose navigator.install() instead of a saved event.
    if (typeof navigator.install === 'function') {
      isPrompting = true;
      let request;
      try { request = navigator.install(); }
      catch (err) { console.warn('Vibra navigator.install failed:', err); }
      try {
        if (!request) { showGuide(); return; }
        await request;
      } catch (err) { console.warn('Vibra navigator.install rejected:', err); showGuide(); }
      finally { isPrompting = false; }
      return;
    }
    showGuide();
  }
  function syncInstallButtons() {
    document.querySelectorAll('[data-action="install-app"]').forEach((button) => {
      button.title = isStandalone() ? 'Vibra already installed' : 'Install Vibra on this device';
      button.setAttribute('aria-label', isStandalone() ? 'Vibra is installed' : 'Install Vibra app');
    });
  }
  function registerServiceWorker() {
    if (!secureHost() || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .then((reg) => { registration = reg; void reg.update().catch(() => {}); })
      .catch((err) => console.warn('Vibra: service worker registration failed:', err));
  }
  // Set up early: app.js is an ES module that can block on Supabase auth or a CDN import.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    syncInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideGuide();
    syncInstallButtons();
    console.info('Vibra installed successfully');
  });
  document.addEventListener('click', (event) => {
    const installButton = event.target.closest?.('[data-action="install-app"]');
    if (!installButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open();
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerServiceWorker, {once: true});
  else registerServiceWorker();
  window.VibraInstall = {open, showGuide, isStandalone, check: () => ({
    secure: secureHost(), standalone: !!isStandalone(), readyToPrompt: !!deferredPrompt,
    serviceWorker: !!registration, scope: new URL('./', location.href).href
  })};
})();
