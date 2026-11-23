/* Vibra Install v3.3 – runs before Supabase authentication and captures browser prompts. */
(() => {
  'use strict';
  const SCRIPT = document.currentScript?.src || new URL('pwa.js', location.href).href;
  const BASE = new URL('./', SCRIPT);
  const BASE_PATH = BASE.pathname;
  const URLS = {
    home: BASE.href,
    manifest: new URL('manifest.json?v=3.3', BASE).href,
    worker: new URL('sw.js', BASE).href,
    diagnostics: new URL('install-check.html?v=3.3', BASE).href,
    icon: new URL('assets/icon-192.png', BASE).href
  };
  let installEvent = null;
  let installed = false;
  let swRegistration = null;
  let lastSwError = '';
  let busy = false;
  const ios = () => /iP(?:hone|ad|od)/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = () => /Android/i.test(navigator.userAgent);
  const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok/i.test(navigator.userAgent);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const secure = () => isSecureContext && (location.protocol === 'https:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname));

  function status() {
    return {
      version: '3.3.0', page: location.href, base: BASE_PATH,
      secure: secure(), standalone: standalone() || installed,
      nativePromptReady: !!installEvent,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      workerReady: !!swRegistration?.active,
      serviceWorkerError: lastSwError,
      android: android(), ios: ios(), inAppBrowser: inAppBrowser()
    };
  }
  function hide() { document.querySelector('#vibra-install-sheet')?.remove(); }
  function copyText(str) {
    if (navigator.clipboard?.writeText && window.isSecureContext) return navigator.clipboard.writeText(str);
    const input = document.createElement('textarea'); input.value = str; input.style.position='fixed'; input.style.top='-1000px';
    document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); return Promise.resolve();
  }
  function guide(message) {
    hide();
    const root=document.createElement('div');
    root.id='vibra-install-sheet'; root.className='vibra-install-backdrop';
    const state=status();
    let title='Install Vibra';
    let intro=message || '';
    let steps=[];
    if (state.standalone) {
      title='Vibra is already installed';
      intro=intro || 'You are using the installed web app. Find Vibra on your home screen or app list.';
    } else if (!state.secure) {
      title='Open the live HTTPS website';
      intro=intro || 'This page must use HTTPS for web-app installation.';
      steps=['Open https://dipam03.github.io/Vibra/ on your phone.', 'Tap Install Vibra there.'];
    } else if (state.ios) {
      title='Install Vibra on iPhone';
      intro=intro || 'Apple does not allow websites to open the Home Screen installation dialog automatically.';
      steps=['Open the site in Safari.', 'Tap Share (square with an up arrow).','Select Add to Home Screen. If shown, turn on Open as Web App.','Tap Add. Vibra will appear on your home screen.'];
    } else if (state.inAppBrowser) {
      title='Open Vibra in Chrome';
      intro=intro || 'WhatsApp/Instagram in-app browsers usually do not allow PWA installation.';
      steps=['Tap the menu in this browser and choose Open in browser / Open in Chrome.', 'Open the website in Google Chrome.', 'Tap the Install button again or use Chrome menu ⋮ → Install app.'];
    } else if (state.android) {
      title='Install Vibra on Android';
      intro=intro || 'Chrome has not provided a one-tap installation prompt on this device yet.';
      steps=['Open Vibra directly in Google Chrome.', 'Tap Chrome menu ⋮ at the top-right.', 'Choose Install app or Add to Home screen.','Confirm Install. If only Create shortcut appears, the browser has not approved full PWA installation.'];
    } else {
      intro=intro || 'Your current browser did not provide its native install prompt.';
      steps=['Open Vibra in Chrome or Microsoft Edge.', 'Open the browser menu and select Install app / Install Vibra, if available.'];
    }
    const ol=steps.length?`<ol class="vibra-install-steps">${steps.map(s=>`<li>${s}</li>`).join('')}</ol>`:'';
    root.innerHTML=`<section class="vibra-install-panel" role="dialog" aria-modal="true" aria-labelledby="vibra-pwa-title">
      <button class="vibra-install-close" type="button" data-pwa-close aria-label="Close">×</button>
      <div class="vibra-install-app-row"><img src="${URLS.icon}" alt="Vibra icon" width="64" height="64"><div><strong>Vibra</strong><span>Install from your GitHub Pages website</span></div></div>
      <h2 id="vibra-pwa-title">${title}</h2><p id="vibra-pwa-msg"></p>${ol}
      <div id="vibra-pwa-state" class="vibra-install-check" role="status"></div>
      <div class="vibra-install-actions"><button type="button" class="vibra-install-secondary" data-pwa-copy>Copy website link</button><button type="button" class="vibra-install-primary" data-pwa-retry>Try again</button></div>
      <a href="${URLS.diagnostics}" style="display:block;text-align:center;margin-top:14px;color:#ff6875;text-decoration:underline;font-size:13px;font-weight:700">Check why installation is unavailable</a>
    </section>`;
    root.querySelector('#vibra-pwa-msg').textContent=intro;
    root.querySelector('#vibra-pwa-state').textContent=state.standalone?'Already installed':state.nativePromptReady?'Native install prompt ready':state.serviceWorkerError?'Service worker error: '+state.serviceWorkerError:'Browser install prompt not ready. Use the instructions above.';
    root.addEventListener('click', e=>{
      if (e.target===root||e.target.closest('[data-pwa-close]')) hide();
      if (e.target.closest('[data-pwa-copy]')) void copyText(URLS.home).then(()=>{e.target.textContent='Link copied';}).catch(()=>{});
      if (e.target.closest('[data-pwa-retry]')) {hide();void startInstall();}
    });
    if(!document.body) return; document.body.append(root);
  }
  function startInstall() {
    if (busy) return;
    if (standalone() || installed) {guide();return;}
    if (installEvent) {
      const event=installEvent;
      installEvent=null;
      busy=true;
      // IMPORTANT: prompt() is called directly from the click handler; not after async checks.
      try {
        const promise=event.prompt();
        Promise.resolve(promise).then(()=>event.userChoice).then(choice=>{
          if(choice?.outcome==='dismissed') guide('Installation was dismissed. You can use the Chrome menu to install Vibra.');
        }).catch(err=>guide('The browser did not open the installation prompt: '+(err?.message||'Unknown error'))).finally(()=>{busy=false;});
      } catch (err) {busy=false;guide('Browser blocked the install prompt: '+(err?.message||'Unknown error'));}
      return;
    }
    if (typeof navigator.install === 'function') {
      busy=true;
      try { Promise.resolve(navigator.install()).catch(err=>guide('Browser install did not complete: '+(err?.message||'Unknown error'))).finally(()=>{busy=false;}); }
      catch (err) {busy=false;guide('Browser install could not start: '+(err?.message||'Unknown error'));}
      return;
    }
    guide();
  }
  function updateInstallButtons(){
    document.querySelectorAll('[data-action="install-app"]').forEach(el=>{
      el.title=standalone()||installed?'Vibra is installed':installEvent?'Install Vibra now':'Install Vibra (browser instructions)';
    });
  }
  async function setupWorker(){
    if (!secure() || !('serviceWorker' in navigator)) return;
    try {
      swRegistration=await navigator.serviceWorker.register(URLS.worker,{scope:BASE_PATH, updateViaCache:'none'});
      lastSwError='';
      await swRegistration.update().catch(()=>{});
    } catch(e){lastSwError=String(e?.message||e);console.warn('Vibra PWA worker:',e);}
  }
  // Capture as soon as possible, even when app.js or Supabase fails to load.
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;updateInstallButtons();});
  window.addEventListener('appinstalled',()=>{installed=true;installEvent=null;hide();updateInstallButtons();});
  document.addEventListener('click',e=>{
    const install=e.target.closest?.('[data-action="install-app"], [data-vibra-install]');
    if(!install) return;
    e.preventDefault();e.stopImmediatePropagation();startInstall();
  },true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{void setupWorker();updateInstallButtons();},{once:true});
  else {void setupWorker();updateInstallButtons();}
  window.VibraInstall={open:startInstall,showGuide:guide,check:status,isStandalone:standalone};
})();
