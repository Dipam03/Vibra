/* Vibra • vanilla JavaScript + Supabase JS 2.95.0 (pinned CDN import).
   Requires config.js and supabase-schema.sql. All persistent social data lives in Supabase. */
const config = window.VIBRA_CONFIG || {};
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '')
  && !!config.supabasePublishableKey && !/REPLACE|YOUR|secret|service_role/i.test(config.supabasePublishableKey);
let supaModule = null, sdkLoadError = null;
if (ready) {
  try { supaModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm'); }
  catch(e) { sdkLoadError = e; console.error('Supabase SDK failed to load:', e); }
}
const db = ready && supaModule ? supaModule.createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
}) : null;
const app = document.getElementById('app');
const S = {
  user: null, me: null, view: 'home', viewUser: null, feedMode: 'all', profileTab: 'posts',
  feed: [], explore: [], reels: [], stories: [], suggestions: [], following: new Map(),
  people: new Map(), posts: new Map(), saved: new Set(), notifications: [], blocked: new Set(),
  conversations: [], activeChat: null, messages: [], searchResults: [], searchPosts: [],
  searchText: '', modal: null, previewFiles: [], uploadType: 'post', busy: false,
  light: (()=>{try{return localStorage.getItem('vibra-theme')==='light';}catch{return false;}})(),
  signed: new Map(), feedToken: 0, screenToken: 0, channel: null, chatChannel: null,
  storyPointer: 0, storyItems: [], storyStats: new Map(), storyInsightsOpen:false,
  postObserver:null, postSeen:new Set(), installPrompt:null, installed: window.matchMedia?.('(display-mode: standalone)').matches||false,
  inboxTab:'chats', reelObserver: null, reelPausedByUser:new Set(), preview: false, shareSearchResults:[], lastShareId:null, chatSummaries:new Map()
};
const ICON_PATHS = {
  'house':'<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22v-8h6v8"/>',
  'search':'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  'compass':'<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.7 5.7-5.7 2.7 2.7-5.7z"/>',
  'clapperboard':'<path d="M4 11h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 11 2.3 6.1a2 2 0 0 1 1.3-2.6L17.5.2a2 2 0 0 1 2.4 1.4l1.5 5L4 11Z"/><path d="m6.7 3.4 4.5 6M13.4 1.7l4.5 6"/>',
  'send':'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  'heart':'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  'square-plus':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8m-4-4h8"/>',
  'circle-user-round':'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M5.5 19c1.2-4.4 11.8-4.4 13 0"/>',
  'settings':'<path d="M12 2.5 14 4l2.5-.4 1.5 2.2-.5 2.4L20 10v4l-2.5 1.8.5 2.4-1.5 2.2L14 20l-2 1.5L10 20l-2.5.4L6 18.2l.5-2.4L4 14v-4l2.5-1.8L6 5.8l1.5-2.2L10 4Z"/><circle cx="12" cy="12" r="3"/>',
  'plus':'<path d="M12 5v14M5 12h14"/>',
  'message-circle':'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5Z"/>',
  'bookmark':'<path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-5-7 5z"/>',
  'badge-check':'<path d="m12 2 2.3 1.5 2.7-.1 1.2 2.5 2.3 1.4-.3 2.7L22 12l-1.8 2 .3 2.7-2.3 1.4-1.2 2.5-2.7-.1L12 22l-2.3-1.5-2.7.1-1.2-2.5-2.3-1.4.3-2.7L2 12l1.8-2-.3-2.7 2.3-1.4L7 3.4l2.7.1Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  'ellipsis':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'sliders-horizontal':'<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  'check-check':'<path d="m18 6-7 7-3-3m14 0-10 10-4-4M2 12l4 4"/>',
  'check-circle':'<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  'circle-alert':'<circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>',
  'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-left':'<path d="M19 12H5m6-6-6 6 6 6"/>',
  'chevron-right':'<path d="m9 18 6-6-6-6"/>',
  'chevron-left':'<path d="m15 18-6-6 6-6"/>',
  'camera':'<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
  'grid-3x3':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  'sparkles':'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8ZM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6Z"/>',
  'images':'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/><circle cx="13" cy="13" r="1"/><path d="m8 19 4-4 3 3 2-2 4 3"/>',
  'image-plus':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6m-3-3v6m-9 6 5-5 4 4 3-3 6 6"/>',
  'image-off':'<path d="M4 4 20 20M9 3h10a2 2 0 0 1 2 2v11M3 9V5a2 2 0 0 1 2-2h.5M3 14v5a2 2 0 0 0 2 2h14M3 18l5-5 3 3m4-2 2-2"/>',
  'info':'<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',
  'key-round':'<circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 7.5-7.5 3 3-2 2m-2 0 2 2"/>',
  'link':'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/>',
  'lock':'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  'lock-keyhole':'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/>',
  'log-out':'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  'map-pin':'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  'messages-square':'<rect x="3" y="3" width="15" height="14" rx="2"/><path d="M8 17v4l5-4m4-9h3a2 2 0 0 1 2 2v10h-6"/>',
  'pencil':'<path d="m15 5 4 4M3 21l5-.8L21 7a2.8 2.8 0 0 0-4-4L4 16Z"/>',
  'search-check':'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16.2 16.2 5 5m-14-11 2 2 4-4"/>',
  'settings-2':'<path d="M4 7h16m-16 10h16"/>',
  'shield-ban':'<path d="M12 22c6-3 8-8 8-14l-8-5-8 5c0 6 2 11 8 14Z"/><path d="m6 6 12 12"/>',
  'shield-check':'<path d="M12 22c6-3 8-8 8-14l-8-5-8 5c0 6 2 11 8 14Z"/><path d="m8 12 3 3 5-5"/>',
  'square-pen':'<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M16 5l3 3M10 14l9-9a2.1 2.1 0 0 1 3 3l-9 9-4 1Z"/>',
  'sun-moon':'<circle cx="9" cy="9" r="4"/><path d="M9 1v2m0 12v2M1 9h2m12 0h2m-3.8-6.2 1.4-1.4M4.8 13.2l-1.4 1.4M20 14a7 7 0 1 1-8 8 7 7 0 0 0 8-8Z"/>',
  'trash-2':'<path d="M3 6h18m-2 0-1 15H6L5 6m3 0V3h8v3M10 10v7m4-7v7"/>',
  'user-round-pen':'<circle cx="10" cy="8" r="4"/><path d="M3 21v-3a7 7 0 0 1 11-5.8m2 3.8 4-4 2 2-4 4-3 1Z"/>',
  'user-plus':'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 13-4m4-7v8m-4-4h8"/>',
  'user-check':'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 13-4m2-3 2 2 4-4"/>',
  'user-x':'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 13-4m3-5 5 5m0-5-5 5"/>',
  'clock':'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'x':'<path d="M18 6 6 18M6 6l12 12"/>',
  'play':'<path d="M8 5v14l11-7Z"/>',
  'pause':'<path d="M8 5v14M16 5v14"/>',
  'download':'<path d="M12 3v13m-5-5 5 5 5-5M4 19h16"/>',
  'eye':'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  'inbox':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>'
};
const I = (icon, size=22, cls='') => `<svg class="lucide ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[icon]||ICON_PATHS.sparkles}</svg>`;
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const a = h;
const uid = () => S.user?.id;
const niceTime = d => { const t = new Date(d); const n = Math.max(0,(Date.now()-t.getTime())/1000); return n<60?'now':n<3600?`${Math.floor(n/60)}m`:n<86400?`${Math.floor(n/3600)}h`:n<604800?`${Math.floor(n/86400)}d`:t.toLocaleDateString(undefined,{month:'short',day:'numeric'}); };
const num = n => n>=1e6?(n/1e6).toFixed(1)+'m':n>=1e3?(n/1e3).toFixed(1)+'k':String(n||0);
const initials = p => (p?.display_name || p?.username || 'V').slice(0,1).toUpperCase();
const name = p => p?.display_name || p?.username || 'Member';
const badge = p => p?.is_verified ? I('badge-check',16,'verify-icon verified-badge') : '';
function recentAccounts(){try{return JSON.parse(localStorage.getItem('vibra-recent-accounts')||'[]').filter(x=>typeof x==='string').slice(0,5);}catch{return [];}}
function rememberAccount(email){if(!email)return;try{localStorage.setItem('vibra-recent-accounts',JSON.stringify([email.toLowerCase(),...recentAccounts().filter(x=>x!==email.toLowerCase())].slice(0,5)));}catch{}}
function shareTargetMarkup(list,postId){return list.map(p=>`<button type="button" class="result-user share-person" data-action="share-to-user" data-id="${a(p.id)}" data-post="${a(postId)}">${avatar(p)}<span><strong>@${h(p.username)} ${badge(p)}</strong><small>${h(name(p))}</small></span>${I('send',19)}</button>`).join('')||'<p class="muted small">No matching users. Search by username.</p>';}
function mentionHtml(text){return h(text||'').replace(/(^|[^\w])@([a-z0-9_]{3,24})\b/gi,(_m,prefix,handle)=>`${prefix}<button type="button" class="mention-link" data-action="profile-username" data-username="${a(handle.toLowerCase())}">@${h(handle)}</button>`);}
function mentionPicker(input){
 const root=input.closest('.mention-root'),host=root?.querySelector('.mention-choices');if(!host)return;
 const before=input.value.slice(0,input.selectionStart||0),match=before.match(/(^|\s)@([a-z0-9_]{0,24})$/i);
 if(!match){host.innerHTML='';host.hidden=true;return;}
 const term=match[2].toLowerCase();const candidates=[...S.people.values()].filter(p=>p.id!==uid()&&p.username?.toLowerCase().startsWith(term)).slice(0,6);
 host.innerHTML=candidates.map(p=>`<button type="button" data-action="pick-mention" data-username="${a(p.username)}">${avatar(p,'xs')} <strong>@${h(p.username)}</strong> ${badge(p)}</button>`).join('');host.hidden=!candidates.length;
}

const getProfile = id => S.people.get(id) || (id === uid() ? S.me : null);
const dataImg = (path, alt='Photo', cls='') => `<img class="${cls}" data-private-path="${a(path)}" alt="${a(alt)}" loading="lazy" />`;
const dataVid = (path, cls='', autoplay=false) => `<video class="${cls}" data-private-path="${a(path)}" playsinline loop muted ${autoplay?'data-autoplay="1"':''} controls preload="metadata"></video>`;
const reelVideo = path => `<video class="reel-vid" data-private-path="${a(path)}" playsinline webkit-playsinline loop preload="metadata" disablepictureinpicture disableremoteplayback></video>`;
const avatar = (p, size='md', ring=false) => {
  const path = p?.avatar_path;
  const url = path && db ? db.storage.from('avatars').getPublicUrl(path).data.publicUrl : '';
  return `<span class="avatar avatar-${size} ${ring?'avatar-ring':''}" title="${a(p?.username || 'Profile')}">${url ? `<img src="${a(url)}" alt="${a(p?.username||'Profile')}" loading="lazy">` : `<span class="avatar-letter">${h(initials(p))}</span>`}</span>`;
};
const canCommentOn = id => {const p=getProfile(id); if(!p || id===uid())return true;return p.comment_privacy==='everyone'||!p.comment_privacy||(p.comment_privacy==='followers'&&S.following.get(id)==='accepted');};
const hasStory = id => Boolean(id && S.stories.some(st => st.user_id === id && new Date(st.expires_at) > new Date()));
const storyAvatar = (p, size='sm') => `<button type="button" class="avatar-story-button ${hasStory(p?.id)?'active-story':''}" data-action="${hasStory(p?.id)?'view-story':'profile'}" data-id="${a(p?.id||'')}" title="${hasStory(p?.id)?'View story':'Open profile'}">${avatar(p,size,hasStory(p?.id))}</button>`;
const installButton = cls => `<button class="${cls}" type="button" data-action="install-app">${I('download',18)} <span>Install app</span></button>`;
const onError = e => { console.error(e); toast(e?.message || String(e) || 'Something went wrong', 'error'); };
function toast(message, kind='success') {
  const el=document.createElement('div'); el.className=`toast ${kind}`;
  el.innerHTML=`${I(kind==='error'?'circle-alert':'check-circle',18)}<span>${h(message)}</span>`;
  document.getElementById('toast-container').append(el); icons(); setTimeout(()=>el.remove(),4300);
}
function icons() { /* Icons are locally rendered as SVG; no CDN needed. */ }
function getUploadSuffix(file) {
  const map={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
  return map[file.type] || null;
}
function validateFile(file, type='media') {
  const max=type==='avatar'?5:50;
  if(!getUploadSuffix(file) || (type==='avatar'&&!file.type.startsWith('image/'))) throw Error('Unsupported file format');
  if(file.size>max*1024*1024) throw Error(`File must be under ${max} MB`);
}
async function upload(file, bucket='media') {
  validateFile(file,bucket==='avatars'?'avatar':'media');
  const path=`${uid()}/${crypto.randomUUID()}.${getUploadSuffix(file)}`;
  const {error}=await db.storage.from(bucket).upload(path,file,{cacheControl:'3600',contentType:file.type,upsert:false});
  if(error) throw error;
  return path;
}
async function privateUrl(path) {
  if(!path) return '';
  const c=S.signed.get(path);
  if(c && c.expires>Date.now()) return c.url;
  const {data,error}=await db.storage.from('media').createSignedUrl(path,3600);
  if(error) throw error;
  S.signed.set(path,{url:data.signedUrl,expires:Date.now()+3300000});
  return data.signedUrl;
}
async function hydrateMedia(root=document) {
  if(!db) return;
  const elements=[...root.querySelectorAll('[data-private-path]')];
  await Promise.all(elements.map(async el => {
    if(el.dataset.hydrating || el.dataset.hydrated) return;
    el.dataset.hydrating='1';
    try { const url=await privateUrl(el.dataset.privatePath); if(el.isConnected){ el.src=url; el.dataset.hydrated='1'; } }
    catch(e){if(el.isConnected) el.classList.add('media-failed'); console.warn('Media unavailable:',e.message);}
    delete el.dataset.hydrating;
  }));
  installReelObserver();
}
function paint() { document.body.classList.toggle('light-theme', S.light); render(); }
function render() {
  if(!ready) { renderSetup(); return; }
  if(!db) { renderSdkError(); return; }
  if(!S.user) { renderAuth(); return; }
  app.innerHTML=`<div class="app-shell view-${S.view}">
    ${sidebar()}
    <div class="center-panel"><header class="mobile-header"><button class="brand" data-action="nav" data-view="home"><span class="brand-emblem">v.</span>vibra<span class="brand-dot">.</span></button><div class="mobile-head-actions"><button class="icon-btn mobile-install-btn" data-action="install-app" title="Install Vibra">${I('download',17)}<span>Install</span></button><button class="icon-btn" data-action="nav" data-view="notifications">${I('heart',23)}${unreadCount()?'<span class="mini-dot"></span>':''}</button><button class="icon-btn" data-action="nav" data-view="messages">${I('send',22)}</button></div></header><div class="screen" id="screen">${screen()}</div></div>
    ${rightRail()}
    ${mobileNav()}
    <div id="modal-root">${modalMarkup()}</div>
  </div>`;
  icons(); hydrateMedia(app); installPostObserver(); window.VibraInstall?.refresh?.();
}
function sidebar() {
  const tabs=[['home','house','Home'],['search','search','Search'],['explore','compass','Explore'],['reels','clapperboard','Reels'],['messages','send','Messages'],['notifications','heart','Notifications'],['create','square-plus','Create'],['profile','circle-user-round','Profile']];
  return `<aside class="sidebar"><button class="brand" data-action="nav" data-view="home"><span class="brand-emblem">v.</span><span>vibra<span class="brand-dot">.</span></span></button>
    <div class="side-caption">YOUR SPACE, YOUR PEOPLE</div><nav class="side-nav">${tabs.map(([view,icon,label])=>`<button class="nav-item ${S.view===view?'active':''}" data-action="${view==='create'?'open-create':'nav'}" data-view="${view}">${I(icon,23)}<span>${label}</span>${view==='notifications'&&unreadCount()?`<b class="count-dot">${num(unreadCount())}</b>`:''}</button>`).join('')}</nav>
    <div class="sidebar-bottom">${installButton('nav-item install-nav')}<button class="nav-item" data-action="open-settings">${I('settings',23)}<span>Settings</span></button><button class="my-side" data-action="nav" data-view="profile">${avatar(S.me)}<span><strong>${h(name(S.me))}</strong><small>@${h(S.me?.username)}</small></span>${I('ellipsis',20)}</button></div></aside>`;
}
function mobileNav() {
  return `<nav class="mobile-bottom">${[['home','house'],['explore','compass'],['create','square-plus'],['reels','clapperboard'],['profile','circle-user-round']].map(([v,ic])=>`<button class="${S.view===v?'active':''}" data-action="${v==='create'?'open-create':'nav'}" data-view="${v}">${v==='profile'?avatar(S.me,'xs'):I(ic,24)}</button>`).join('')}</nav>`;
}
function rightRail() {
  if(['messages','reels'].includes(S.view)) return `<aside class="right-rail rail-clean"><div class="rail-brand"><span class="gradient-orb"></span><h3>Find your people.</h3><p>Stay close to the moments that matter.</p></div></aside>`;
  return `<aside class="right-rail"><div class="rail-profile">${avatar(S.me,'lg')}<span><strong>${h(S.me?.username)}</strong><small>${h(name(S.me))}</small></span><button class="text-link" data-action="open-settings">Edit</button></div>
    <div class="rail-title"><strong>People you might like</strong><button data-action="nav" data-view="search">See all</button></div>
    <div class="recommendations">${S.suggestions.slice(0,5).map(p=>`<div class="person-suggest"><button data-action="profile" data-id="${p.id}">${avatar(p)}<span><strong>${h(p.username)}</strong><small>${h(p.display_name || 'Discover someone new')}</small></span></button><button class="tiny-follow" data-action="follow" data-id="${p.id}">Follow</button></div>`).join('')||'<p class="muted small">Find more people in Search.</p>'}</div>
    <div class="rail-footer">About · Help · Privacy · Terms<br>© ${new Date().getFullYear()} Vibra Social</div></aside>`;
}
function unreadCount() { return S.notifications.filter(n=>!n.is_read).length; }
function screen() {
  if(S.loading) return `<div class="loading-content"><div class="spinner"></div><p>Finding your moments...</p></div>`;
  switch(S.view){
    case 'home': return homeMarkup();
    case 'explore': return exploreMarkup();
    case 'reels': return reelsMarkup();
    case 'profile': return profileMarkup();
    case 'messages': return messagesMarkup();
    case 'notifications': return notificationsMarkup();
    case 'search': return searchMarkup();
    default: return homeMarkup();
  }
}
function homeMarkup() {
  const feed=S.feed.filter(p=>S.feedMode==='all'||p.user_id===uid()||S.following.get(p.user_id)==='accepted');
  return `<div class="feed-page"><div class="feed-top"><div><p class="eyebrow">GOOD TO SEE YOU AGAIN</p><h1>Home feed <span class="hello-spark">✦</span></h1></div><button class="feed-create" data-action="open-create">${I('plus',19)} Share a moment</button></div>
    <div class="feed-layout"><div class="feed-col"><section class="story-card"><div class="story-head"><strong>Stories</strong><span>Moments that last 24 hours</span></div><div class="stories-track"><div class="story-tile own-story"><button type="button" data-action="${hasStory(uid())?'view-story':'open-create'}" data-id="${uid()}" data-type="story" class="story-avatar-hit ${hasStory(uid())?'has-story':''}">${avatar(S.me,'story',hasStory(uid()))}</button><button type="button" class="story-add" data-action="open-create" data-type="story" title="Add story">${I('plus',14)}</button><small>Your story</small></div>${storyProfiles().filter(p=>p.id!==uid()).map(item=>`<button class="story-tile" data-action="view-story" data-id="${item.id}"><span class="story-ring">${avatar(item,'story')}</span><small>${h(item.username)}</small></button>`).join('')}</div></section>
      <div class="feed-switch"><button data-action="feed-filter" data-filter="all" class="${S.feedMode==='all'?'on':''}">For you</button><button data-action="feed-filter" data-filter="following" class="${S.feedMode==='following'?'on':''}">Following</button><span class="feed-switch-end">${I('sliders-horizontal',17)}</span></div>
      <section class="post-list">${feed.length?feed.map(postCard).join(''):emptyState('image','Your feed starts here','Share your first post or follow someone to see their moments.','Explore posts','explore')}</section></div></div></div>`;
}
function storyProfiles() {
  const seen=new Set(); return S.stories.filter(st=>{if(seen.has(st.user_id))return false; seen.add(st.user_id);return true;}).map(st=>getProfile(st.user_id)||{id:st.user_id,username:'member'});
}
function postCard(p) {
  const person=getProfile(p.user_id)||{}; const count=p.likeCount||0;
  const media=p.media||[]; const first=media[p.slide||0];
  return `<article class="post-card" data-post-id="${p.id}"><div class="post-head"><div class="post-author">${storyAvatar(person,'sm')}<button type="button" class="post-author-name" data-action="profile" data-id="${p.user_id}"><span><strong>${h(person.username||'member')} ${badge(person)}</strong><small>${h(p.location||'')} ${p.location?' · ':''}${niceTime(p.created_at)} ago</small></span></button></div><button class="icon-btn" data-action="post-options" data-id="${p.id}">${I('ellipsis',23)}</button></div>
    <div class="post-media">${first?(first.media_type==='video'?dataVid(first.storage_path,'post-main-video'):dataImg(first.storage_path,`Post by ${person.username}`,'post-main-img')):`<div class="post-media-missing">${I('image-off',36)}</div>`}${media.length>1?`<div class="media-pips">${media.map((_,i)=>`<span class="${i===(p.slide||0)?'selected':''}"></span>`).join('')}</div>${p.slide?`<button class="media-prev" data-action="slide" data-id="${p.id}" data-dir="-1">${I('chevron-left',18)}</button>`:''}${(p.slide||0)<media.length-1?`<button class="media-next" data-action="slide" data-id="${p.id}" data-dir="1">${I('chevron-right',18)}</button>`:''}`:''}</div>
    <div class="post-actions"><button title="Like" class="icon-btn ${p.liked?'is-liked':''}" data-action="like" data-id="${p.id}">${I('heart',25)}</button><button title="Comment" class="icon-btn" data-action="comments" data-id="${p.id}">${I('message-circle',24)}</button><button title="Share" class="icon-btn" data-action="share" data-id="${p.id}">${I('send',23)}</button><span class="spacer"></span><button title="Save" class="icon-btn ${S.saved.has(p.id)?'is-saved':''}" data-action="save" data-id="${p.id}">${I('bookmark',25)}</button></div>
    <div class="post-copy"><strong>${num(count)} ${count===1?'like':'likes'}</strong>${p.user_id===uid()?`<button type="button" class="insights-inline" data-action="post-insights" data-id="${p.id}">${I('eye',15)} View insights</button>`:''}<p><button data-action="profile" data-id="${p.user_id}" class="inline-user">${h(person.username||'member')}</button> ${captionHtml(p.caption)}</p><button class="comment-link" data-action="comments" data-id="${p.id}">View comments${p.commentCount?' · '+num(p.commentCount):''}</button></div>
    ${canCommentOn(p.user_id)?`<form class="quick-comment" data-form="comment" data-post-id="${p.id}"><div class="mention-root"><input name="body" data-mention-input="1" placeholder="Add a comment... @friend" maxlength="1000" required aria-label="Add a comment" autocomplete="off"/><div class="mention-choices" hidden></div></div><button type="submit">Post</button></form>`:'<div class="comment-closed">Comments are limited by this account.</div>'}</article>`;
}
function captionHtml(c) { return mentionHtml(c||'').replace(/(^|\s)(#[\w]+)/g,(_m,w,t)=>`${w}<button class="hashtag" data-action="tag" data-tag="${a(t)}">${t}</button>`).replace(/\n/g,'<br>'); }
function emptyState(icon,title,desc,button,view) {
  return `<div class="empty-state"><div class="empty-icon">${I(icon,35)}</div><h2>${h(title)}</h2><p>${h(desc)}</p>${button?`<button class="primary-btn" data-action="nav" data-view="${view}">${h(button)}</button>`:''}</div>`;
}
function exploreMarkup() {
  return `<div class="content-page"><div class="section-heading"><div><p class="eyebrow">FIND YOUR NEXT FAVORITE</p><h1>Explore<span class="brand-dot">.</span></h1><p>Discover the stories everyone's sharing.</p></div><button class="rounded-icon" data-action="nav" data-view="search">${I('search')}</button></div>
    <div class="discover-top">${I('sparkles',20)} <span>Fresh perspectives, new people, infinite inspiration.</span></div>
    <div class="explore-grid">${S.explore.length?S.explore.map((p,i)=>{const m=p.media?.[0];return `<button class="explore-item ${i%9===2?'feature':''}" data-action="comments" data-id="${p.id}">${m?(m.media_type==='video'?dataVid(m.storage_path,'tile-media'):dataImg(m.storage_path,'Explore photo','tile-media')):''}<span class="tile-overlay">${I('heart',18)} ${num(p.likeCount||0)} &nbsp; ${I('message-circle',18)} ${num(p.commentCount||0)}</span>${p.is_reel?`<i class="tile-reel">${I('clapperboard',21)}</i>`:''}</button>`}).join(''):emptyState('compass','Nothing to explore yet','The community will come alive when members start sharing.','Create a post','home')}</div></div>`;
}
function reelsMarkup() {
  return `<div class="reels-page"><header class="reels-top"><button type="button" class="reels-back" data-action="nav" data-view="home" aria-label="Back to home">${I('arrow-left',23)}</button><h1>Reels</h1><button class="reels-create" data-action="open-create" data-type="reel" aria-label="Create a reel">${I('plus',23)}</button></header><div class="reel-scroll">${S.reels.length?S.reels.map(p=>{
    const pers=getProfile(p.user_id)||{}; const media=p.media?.find(m=>m.media_type==='video');
    return `<article class="reel-item" data-reel-id="${p.id}"><div class="reel-video">${media?reelVideo(media.storage_path):''}<div class="reel-shade"></div><button type="button" class="reel-tap-target" data-action="toggle-reel" data-id="${p.id}" aria-label="Play or pause reel"></button><div class="reel-state" aria-hidden="true">${I('play',44)}<small>Tap to play with sound</small></div><div class="reel-info"><button data-action="profile" data-id="${p.user_id}" class="reel-user">${avatar(pers,'sm')}<strong>@${h(pers.username)} ${badge(pers)}</strong></button><p>${captionHtml(p.caption)}</p></div><div class="reel-actions"><button aria-label="Like reel" data-action="like" data-id="${p.id}" class="${p.liked?'is-liked':''}">${I('heart',27)}<span>${num(p.likeCount||0)}</span></button><button aria-label="Comment on reel" data-action="comments" data-id="${p.id}">${I('message-circle',27)}<span>${num(p.commentCount||0)}</span></button><button aria-label="Share reel" data-action="share" data-id="${p.id}">${I('send',27)}</button><button aria-label="Save reel" data-action="save" data-id="${p.id}" class="${S.saved.has(p.id)?'is-saved':''}">${I('bookmark',27)}</button></div></div></article>`}).join(''):emptyState('clapperboard','No reels yet','Be the first to publish a video reel.','Go home','home')}</div></div>`;
}
function profileMarkup() {
  const p=S.viewUser ? getProfile(S.viewUser) : S.me;
  if(!p) return emptyState('user-x','Profile unavailable','This account may have been deleted.','Home','home');
  const own=p.id===uid(); const relation=S.following.get(p.id);
  const posts=[...S.posts.values()].filter(post=>post.user_id===p.id);
  const privateLocked=p.is_private && !own && relation!=='accepted';
  const visible=S.profileTab==='saved'&&own ? [...S.posts.values()].filter(x=>S.saved.has(x.id)) : S.profileTab==='reels'?posts.filter(x=>x.is_reel):posts;
  return `<div class="content-page profile-page"><div class="profile-cover"><div class="cover-orb one"></div><div class="cover-orb two"></div><span class="cover-label">COLLECT MOMENTS • MAKE MEMORIES</span></div>
    <div class="profile-info"><div class="profile-avatar">${storyAvatar(p,'xl')}</div><div class="profile-metadata"><div class="profile-title"><div><h1>${h(p.display_name||p.username)} ${p.is_private?I('lock',17):''}</h1><p>@${h(p.username)} ${badge(p)}</p></div><div class="profile-buttons">${own?`<button class="outline-btn" data-action="edit-profile">${I('pencil',17)} Edit profile</button><button class="rounded-icon" data-action="open-settings">${I('settings',21)}</button>`:`<button class="${relation==='accepted'?'outline-btn':'primary-btn'}" data-action="follow" data-id="${p.id}">${I(relation==='accepted'?'user-check':relation==='pending'?'clock':'user-plus',17)} ${relation==='accepted'?'Following':relation==='pending'?'Requested':'Follow'}</button><button class="outline-btn" data-action="dm-user" data-id="${p.id}">${I('send',17)} Message</button><button class="rounded-icon" data-action="profile-options" data-id="${p.id}">${I('ellipsis')}</button>`}</div></div>
      <div class="profile-stats"><span><b>${num(privateLocked?0:posts.length)}</b> posts</span><button data-action="follow-list" data-id="${p.id}" data-type="followers"><b>${num(p.followersCount||0)}</b> followers</button><button data-action="follow-list" data-id="${p.id}" data-type="following"><b>${num(p.followingCount||0)}</b> following</button></div>
      <div class="profile-bio"><p>${h(p.bio||'Sharing little pieces of life ✨')}</p>${p.website?`<a href="${a(safeLink(p.website))}" target="_blank" rel="noopener noreferrer">${I('link',15)} ${h(p.website)}</a>`:''}</div></div></div>
    ${privateLocked?`<div class="private-profile">${I('lock-keyhole',34)}<h3>This account is private</h3><p>Follow to see photos and videos.</p></div>`:`<div class="profile-tabs"><button class="${S.profileTab==='posts'?'selected':''}" data-action="profile-tab" data-tab="posts">${I('grid-3x3',17)} POSTS</button><button class="${S.profileTab==='reels'?'selected':''}" data-action="profile-tab" data-tab="reels">${I('clapperboard',17)} REELS</button>${own?`<button class="${S.profileTab==='saved'?'selected':''}" data-action="profile-tab" data-tab="saved">${I('bookmark',17)} SAVED</button>`:''}</div><div class="profile-grid">${visible.length?visible.map(post=>{const m=post.media?.[0];return `<button data-action="comments" data-id="${post.id}">${m?(m.media_type==='video'?dataVid(m.storage_path,'tile-media'):dataImg(m.storage_path,'Post photo','tile-media')):''}<span class="tile-overlay">${I('heart',17)} ${num(post.likeCount||0)}</span>${post.is_reel?`<i class="tile-reel">${I('clapperboard',21)}</i>`:''}</button>`}).join(''):`<div class="grid-empty">${I('camera',32)}<h3>No posts to show</h3><p>When moments are shared, they’ll appear here.</p></div>`}</div>`}</div>`;
}
function safeLink(s) { try { const u=new URL(s.startsWith('http')?s:`https://${s}`); return ['https:','http:'].includes(u.protocol)?u.href:'#'; } catch { return '#'; } }
function searchMarkup() {
  return `<div class="content-page search-page"><div class="section-heading"><div><p class="eyebrow">THE WORLD IS WIDE</p><h1>Search<span class="brand-dot">.</span></h1><p>People, captions, and hashtags to explore.</p></div></div>
    <div class="large-search">${I('search',22)}<input id="searchbox" placeholder="Search people, posts, hashtags..." value="${a(S.searchText)}" autocomplete="off"/><span>⌘ K</span></div>
    <div id="search-results">${searchResultsMarkup()}</div></div>`;
}
function searchResultsMarkup() {
  if(!S.searchText.trim()) return `<div class="search-intro">${I('search-check',36)}<h3>What inspires you?</h3><p>Try a username or #hashtag to find moments worth keeping.</p></div>`;
  return `<h3 class="result-heading">People</h3><div class="result-list">${S.searchResults.map(p=>`<button class="result-user" data-action="profile" data-id="${p.id}">${avatar(p,'lg')}<span><strong>${h(p.username)} ${badge(p)}</strong><small>${h(name(p))}</small></span>${I('chevron-right',19)}</button>`).join('')||'<p class="muted">No matching people.</p>'}</div><h3 class="result-heading">Posts</h3><div class="explore-grid search-grid">${S.searchPosts.map(p=>{const m=p.media?.[0];return `<button class="explore-item" data-action="comments" data-id="${p.id}">${m?(m.media_type==='video'?dataVid(m.storage_path,'tile-media'):dataImg(m.storage_path,'Post photo','tile-media')):''}</button>`}).join('')||'<p class="muted">No matching captions.</p>'}</div>`;
}
function notificationsMarkup() {
  return `<div class="content-page notifications-page"><div class="section-heading"><div><p class="eyebrow">THE LITTLE THINGS</p><h1>Activity<span class="brand-dot">.</span></h1><p>All the love, all in one place.</p></div><button class="outline-btn" data-action="read-all">${I('check-check',17)} Mark read</button></div>
    <div class="activity-list">${S.notifications.length?S.notifications.map(n=>{
      const p=getProfile(n.actor_id)||{}; const messages={like:'liked your post',comment:'commented on your post',follow:'started following you',follow_request:'requested to follow you',follow_accept:'accepted your follow request',message:'sent you a message'};
      const go=['like','comment'].includes(n.kind)?'notification-post':n.kind==='message'?'notification-chat':'profile';
      return `<div class="activity-item ${n.is_read?'':'unread'}"><button class="activity-person" data-action="${go}" data-id="${n.target_id||n.actor_id}" data-actor="${n.actor_id}">${avatar(p,'md')}<span><strong>${h(p.username||'someone')} ${badge(p)}</strong> ${h(messages[n.kind]||'interacted with you')}<small>${niceTime(n.created_at)} ago</small></span></button>${n.kind==='follow_request'?`<button class="primary-btn btn-small" data-action="accept-follow" data-id="${n.actor_id}">Confirm</button>`:I('chevron-right',18,'activity-arrow')}</div>`;
    }).join(''):emptyState('heart','All quiet for now','When people interact with you, you’ll see it here.','','')}</div></div>`;
}
function sharedMessage(postId){
 const p=S.posts.get(postId),media=p?.media?.[0],author=getProfile(p?.user_id);
 if(!p)return `<div class="dm-shared-unavailable">${I('lock',16)} Shared post unavailable or private</div>`;
 return `<button type="button" class="dm-shared-card" data-action="open-shared-post" data-id="${a(postId)}">${media?(media.media_type==='video'?dataVid(media.storage_path,'dm-shared-thumb'):dataImg(media.storage_path,'Shared post','dm-shared-thumb')):''}<span class="dm-share-copy"><strong>${p.is_reel?'Shared reel':'Shared post'}</strong><small>@${h(author?.username||'member')} ${badge(author)}</small><em>Tap to view</em></span>${I('chevron-right',18)}</button>`;
}
function messagesMarkup() {
  const active=S.conversations.find(c=>c.id===S.activeChat);
  const requests=S.conversations.filter(c=>c.status==='pending'&&c.recipient_id===uid());
  const threads=S.conversations.filter(c=>S.inboxTab==='requests'?c.status==='pending'&&c.recipient_id===uid():!(c.status==='pending'&&c.recipient_id===uid())&&c.status!=='declined');
  const partner=active?getProfile(active.created_by===uid()?active.recipient_id:active.created_by):null;
  return `<div class="messages-page"><div class="inbox-list"><div class="inbox-head"><div><span class="eyebrow">DIRECT MESSAGES</span><h1>Inbox</h1></div><button class="rounded-icon" data-action="new-chat">${I('square-pen',22)}</button></div><div class="inbox-tabs"><button class="${S.inboxTab==='chats'?'selected':''}" data-action="inbox-tab" data-tab="chats">Messages</button><button class="${S.inboxTab==='requests'?'selected':''}" data-action="inbox-tab" data-tab="requests">Requests ${requests.length?`<b>${requests.length}</b>`:''}</button></div><div class="inbox-filter">${I('search',19)}<input placeholder="Find a conversation" id="chat-filter" /></div><div id="chat-list">${threads.length?threads.map(c=>{
    const id=c.created_by===uid()?c.recipient_id:c.created_by; const p=getProfile(id)||{};
    const sum=S.chatSummaries.get(c.id),last=sum?.last,excerpt=last?(last.shared_post_id?'Shared a post/reel':last.media_type?'Sent a photo or video':last.body||'New message'):null;
    return `<button class="thread-item ${S.activeChat===c.id?'selected':''}" data-action="open-chat" data-id="${c.id}" data-username="${a(p.username)}">${avatar(p,'lg')}<span><strong>${h(name(p))} ${badge(p)}</strong><small>@${h(p.username)} ${c.status==='pending'?'· Pending':''}</small>${excerpt?`<small class="thread-preview">${last.sender_id===uid()?'You: ':''}${h(excerpt.slice(0,75))}</small>`:''}</span>${sum?.unread?`<b class="dm-unread-count">${Math.min(99,sum.unread)}</b>`:I('chevron-right',16)}</button>`;
  }).join(''):`<div class="empty-thread">${I('send',30)}<p>${S.inboxTab==='requests'?'No message requests.':'No chats yet.'}</p>${S.inboxTab==='chats'?'<button class="text-link" data-action="new-chat">Start a conversation</button>':''}</div>`}</div></div>
    <div class="chat-panel">${active?`<div class="chat-header"><button class="back-chat" data-action="close-chat">${I('arrow-left',22)}</button><button class="chat-peer" data-action="profile" data-id="${partner?.id}">${avatar(partner,'sm')}<span><strong>${h(name(partner))} ${badge(partner)}</strong><small>@${h(partner?.username)}</small></span></button></div>${active.status==='pending'?`<div class="request-banner">${active.recipient_id===uid()?`<p>Message request · Reply to ${h(name(partner))} to automatically accept, or use Accept/Decline.</p><div><button class="primary-btn btn-small" data-action="request-decision" data-id="${active.id}" data-status="accepted">Accept</button><button class="outline-btn btn-small" data-action="request-decision" data-id="${active.id}" data-status="declined">Decline</button></div>`:`<p>Request pending · ${h(name(partner))} has not accepted your message yet.</p>`}</div>`:''}<div class="chat-scroll" id="chat-scroll">${S.messages.length?S.messages.map(m=>`<div class="message-row ${m.sender_id===uid()?'mine':'theirs'}"><div class="message-bubble">${m.shared_post_id?sharedMessage(m.shared_post_id):''}${m.media_path?(m.media_type==='video'?dataVid(m.media_path,'chat-media'):dataImg(m.media_path,'Chat attachment','chat-media')):''}${m.body?`<p>${mentionHtml(m.body)}</p>`:''}<small>${niceTime(m.created_at)}${m.sender_id===uid()&&m.read_at?' · Seen':''}</small>${m.sender_id===uid()?`<button type="button" class="dm-unsend" data-action="unsend-message" data-id="${a(m.id)}">Unsend</button>`:''}</div></div>`).join(''):`<div class="chat-welcome">${avatar(partner,'xl')}<h3>${h(name(partner))}</h3><p>Say hello and start a conversation.</p></div>`}</div>${active.status==='accepted'||(active.status==='pending'&&(active.recipient_id===uid()||(active.created_by===uid()&&!S.messages.length)))?`<form class="chat-compose" data-form="message"><label class="chat-attach" title="Attach photo or video">${I('image-plus',22)}<input type="file" id="chat-attachment" accept="image/*,video/mp4,video/webm,video/quicktime" hidden></label><input name="body" placeholder="Message..." autocomplete="off" maxlength="4000" /><button class="send-btn" type="submit">${I('send',19)}</button></form><div class="attachment-caption" id="chat-file-label"></div>`:`<div class="chat-disabled">${active.recipient_id===uid()?'Reply to accept automatically.':'Waiting for request approval.'}</div>`}`:`<div class="no-chat">${I('messages-square',44)}<h2>Your messages</h2><p>Send private photos and messages to your people.</p><button class="primary-btn" data-action="new-chat">${I('send',18)} Send message</button></div>`}</div></div>`;
}
function showReelPlaybackState(video, blocked=false) {
  const card=video?.closest('.reel-item');
  if(!card)return;
  card.classList.toggle('reel-paused',video.paused);
  card.classList.toggle('reel-needs-play',blocked && video.paused);
  const label=card.querySelector('.reel-state small');
  if(label) label.textContent=blocked?'Tap to play with sound':'Tap to resume';
}
async function tryPlayReel(video) {
  if(!video||!video.isConnected||S.view!=='reels'||S.modal||!video.src)return;
  const id=video.closest('[data-reel-id]')?.dataset.reelId;
  if(S.reelPausedByUser.has(id))return;
  video.muted=false; // Never silently mute a reel to bypass autoplay restrictions.
  video.volume=1;
  try { await video.play(); showReelPlaybackState(video,false); }
  catch(e){ showReelPlaybackState(video,true); }
}
function toggleReel(id){
  const card=[...document.querySelectorAll('.reel-item')].find(item=>item.dataset.reelId===id);
  const video=card?.querySelector('video.reel-vid');
  if(!video)return;
  if(video.paused){S.reelPausedByUser.delete(id);void tryPlayReel(video);}
  else{S.reelPausedByUser.add(id);video.pause();showReelPlaybackState(video,false);}
}
function installReelObserver() {
  if(S.reelObserver)S.reelObserver.disconnect();
  if(S.view!=='reels')return;
  if(S.modal){document.querySelectorAll('video.reel-vid').forEach(v=>v.pause());return;}
  const vids=[...document.querySelectorAll('video.reel-vid')];
  vids.forEach(video=>{
    video.muted=false;
    video.addEventListener('pause',()=>showReelPlaybackState(video,false));
    video.addEventListener('playing',()=>showReelPlaybackState(video,false));
    video.addEventListener('loadeddata',()=>{
      if(video.getBoundingClientRect().top >= -innerHeight*.25 && video.getBoundingClientRect().top < innerHeight*.75) void tryPlayReel(video);
    });
    showReelPlaybackState(video,false);
  });
  if(!('IntersectionObserver' in window)){
    if(vids[0])void tryPlayReel(vids[0]);
    return;
  }
  S.reelObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const video=entry.target;
      const id=video.closest('[data-reel-id]')?.dataset.reelId;
      if(entry.isIntersecting && entry.intersectionRatio>=.7){
        for(const other of vids)if(other!==video&&!other.paused)other.pause();
        void tryPlayReel(video);
        if(id)markPostSeen(id).catch(console.warn);
      }else if(!video.paused)video.pause();
    }
  },{root:document.querySelector('.reel-scroll'),threshold:[0,.7]});
  vids.forEach(video=>S.reelObserver.observe(video));
}

// ────────── Modal UI ──────────
function peopleInsightMarkup(people, fallback) {
  return `<div class="insights-people">${people.length?people.map(p=>`<button type="button" class="insight-person" data-action="profile" data-id="${a(p.id)}">${avatar(p,'sm')}<span><strong>@${h(p.username)}</strong><small>${h(name(p))}</small></span>${I('chevron-right',16)}</button>`).join(''):`<p class="muted small">${h(fallback)}</p>`}</div>`;
}
function modalMarkup() {
  if(!S.modal) return '';
  const m=S.modal;
  const close=`<button class="modal-close" data-action="close-modal" aria-label="Close">${I('x',22)}</button>`;
  if(m.type==='create') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog create-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">CREATE SOMETHING NEW</span><h2>Share a moment<span class="brand-dot">.</span></h2></div>${close}</div>
    <div class="create-types">${[['post','grid-3x3','Post'],['story','circle-play','Story'],['reel','clapperboard','Reel']].map(([key,ic,l])=>`<button data-action="upload-type" data-type="${key}" class="${S.uploadType===key?'selected':''}">${I(ic,18)} ${l}</button>`).join('')}</div>
    <form data-form="create"><label class="upload-drop" for="upload-file"><input type="file" id="upload-file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" ${S.uploadType==='post'?'multiple':''} hidden />${S.previewFiles.length?`<div class="upload-previews">${S.previewFiles.map(x=>x.file.type.startsWith('video/')?`<video src="${a(x.url)}" muted controls playsinline></video>`:`<img src="${a(x.url)}" alt="Upload preview">`).join('')}</div>`:`${I('images',42)}<h3>Drop your ${S.uploadType==='story'?'story':S.uploadType==='reel'?'reel':'photos and videos'} here</h3><p>Tap to browse • JPG, PNG, WEBP, GIF, MP4, WEBM</p>`}</label>
    <div class="create-fields"><label>Caption <span class="muted">(optional)</span><textarea name="caption" placeholder="What's the story behind this moment? ✨" maxlength="${S.uploadType==='post'?2200:250}" rows="3">${a(m.caption||'')}</textarea></label>${S.uploadType==='post'?`<label>Location <span class="muted">(optional)</span><div class="input-icon">${I('map-pin',18)}<input name="location" placeholder="Where was this?" maxlength="140" value="${a(m.location||'')}"></div></label>`:''}</div>
    <div class="create-foot"><span>${I('shield-check',16)} Your content, your space</span><button type="submit" class="primary-btn" ${S.busy?'disabled':''}>${S.busy?'Publishing...':I('send',18)+' Publish '+S.uploadType}</button></div></form></div></div>`;
  if(m.type==='edit') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog edit-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">MAKE IT YOURS</span><h2>Edit profile</h2></div>${close}</div><form data-form="edit-profile"><div class="edit-avatar-row">${avatar(S.me,'xl')}<div><strong>Profile photo</strong><label class="link-label">Choose a new image<input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden /></label><small id="avatar-filename"></small></div></div>
    <label>Display name<input name="display_name" required maxlength="80" value="${a(S.me?.display_name)}" /></label><label>Username<input name="username" pattern="[a-z0-9_]{3,24}" required maxlength="24" value="${a(S.me?.username)}" /></label><label>Bio<textarea name="bio" maxlength="250" rows="3">${h(S.me?.bio||'')}</textarea></label><label>Website<input name="website" maxlength="300" value="${a(S.me?.website||'')}" placeholder="https://example.com" /></label>
    <button class="primary-btn btn-full" type="submit" ${S.busy?'disabled':''}>${S.busy?'Saving...':'Save changes'}</button></form></div></div>`;
  if(m.type==='settings') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog settings-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">YOUR ACCOUNT</span><h2>Settings</h2></div>${close}</div>
    <div class="settings-row"><div>${I('lock-keyhole',22)}<span><strong>Private account</strong><small>Only approved followers can see your posts</small></span></div><button class="switch ${S.me?.is_private?'checked':''}" data-action="toggle-private" role="switch" aria-checked="${!!S.me?.is_private}"><span></span></button></div>
    <div class="privacy-section"><h3>Privacy and interactions</h3><label class="privacy-control"><span><strong>Who can comment</strong><small>Applies to new comments on your posts</small></span><select data-setting="comment_privacy"><option value="everyone" ${S.me?.comment_privacy==='everyone'?'selected':''}>Everyone</option><option value="followers" ${S.me?.comment_privacy==='followers'?'selected':''}>Followers</option><option value="off" ${S.me?.comment_privacy==='off'?'selected':''}>Off</option></select></label><label class="privacy-control"><span><strong>Who can message me</strong><small>New contacts go to Message requests</small></span><select data-setting="message_privacy"><option value="everyone" ${S.me?.message_privacy==='everyone'?'selected':''}>Everyone</option><option value="followers" ${S.me?.message_privacy==='followers'?'selected':''}>Followers</option><option value="none" ${S.me?.message_privacy==='none'?'selected':''}>Nobody</option></select></label><label class="privacy-control"><span><strong>Who sees my stories</strong><small>Followers means approved followers only</small></span><select data-setting="story_audience"><option value="everyone" ${S.me?.story_audience==='everyone'?'selected':''}>Everyone allowed by account privacy</option><option value="followers" ${S.me?.story_audience==='followers'?'selected':''}>Followers only</option></select></label></div>
    <div class="settings-row"><div>${I('sun-moon',22)}<span><strong>Light appearance</strong><small>Switch between light and dark</small></span></div><button class="switch ${S.light?'checked':''}" data-action="toggle-theme" role="switch" aria-checked="${!!S.light}"><span></span></button></div>
    <button class="settings-link" data-action="install-app">${I('download',21)} Install Vibra on phone ${I('chevron-right',17)}</button><button class="settings-link" data-action="edit-profile">${I('user-round-pen',21)} Edit profile ${I('chevron-right',17)}</button><button class="settings-link" data-action="change-password">${I('key-round',21)} Change password ${I('chevron-right',17)}</button><button class="settings-link" data-action="blocked-list">${I('shield-ban',21)} Blocked accounts (${S.blocked.size}) ${I('chevron-right',17)}</button><button class="settings-link" data-action="switch-account">${I('users',21)} Switch / add account ${I('chevron-right',17)}</button><button class="settings-link danger" data-action="logout">${I('log-out',21)} Log out ${I('chevron-right',17)}</button><p class="settings-tip">Your posts, messages and follows are stored securely in your Supabase project, not only on this device.</p></div></div>`;
  if(m.type==='password') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Update password</h2>${close}</div><form data-form="new-password"><label>New password<input name="password" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters" /></label><button type="submit" class="primary-btn btn-full">Update password</button></form></div></div>`;
  if(m.type==='blocked') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Blocked accounts</h2>${close}</div><div class="result-list">${[...S.blocked].map(id=>{const p=getProfile(id);return `<div class="result-user">${avatar(p)}<span><strong>${h(p?.username||'Member')}</strong></span><button class="outline-btn" data-action="unblock" data-id="${id}">Unblock</button></div>`}).join('')||'<p class="muted">You have not blocked anyone.</p>'}</div></div></div>`;
  if(m.type==='comments') {
    const p=S.posts.get(m.postId);if(!p) return '';
    const person=getProfile(p.user_id),first=p.media?.[0];
    return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog comments-dialog" role="dialog" aria-modal="true"><div class="detail-media">${first?(first.media_type==='video'?dataVid(first.storage_path,'detail-photo'):dataImg(first.storage_path,'Post image','detail-photo')):''}</div>
      <div class="detail-side"><div class="dialog-head detail-user"><button class="post-author" data-action="profile" data-id="${p.user_id}">${avatar(person,'sm')}<span><strong>${h(person?.username)} ${badge(person)}</strong><small>${niceTime(p.created_at)} ago</small></span></button>${close}</div>
        <div class="detail-comments"><div class="detail-caption">${avatar(person,'sm')}<p><strong>${h(person?.username)} ${badge(person)}</strong> ${captionHtml(p.caption)}</p></div>${m.comments?.length?m.comments.map(c=>{
          const p2=getProfile(c.user_id);return `<div class="comment-entry ${c.parent_id?'is-reply':''}">${avatar(p2,'sm')}<div><p><strong>${h(p2?.username||'member')} ${badge(p2)}</strong> ${mentionHtml(c.body)}</p><small>${niceTime(c.created_at)}${canCommentOn(p.user_id)?` · <button data-action="reply" data-id="${c.id}" data-username="${a(p2?.username||'member')}">Reply</button>`:''}${c.user_id===uid()||p.user_id===uid()?` · <button data-action="delete-comment" data-id="${c.id}">Delete</button>`:''}</small></div></div>`;
        }).join(''):'<div class="muted empty-comments">No comments yet. Start the conversation.</div>'}</div>
        <div class="detail-actionbar"><button class="icon-btn ${p.liked?'is-liked':''}" data-action="like" data-id="${p.id}">${I('heart',23)}</button><button class="icon-btn" data-action="share" data-id="${p.id}">${I('send',22)}</button><button class="icon-btn ${S.saved.has(p.id)?'is-saved':''}" data-action="save" data-id="${p.id}">${I('bookmark',23)}</button><span>${num(p.likeCount||0)} likes</span></div>
        ${canCommentOn(p.user_id)?`<form class="detail-reply" data-form="comment" data-post-id="${p.id}"><div class="mention-root"><input name="body" data-mention-input="1" required maxlength="1000" placeholder="${m.replyTo?'Reply to @'+m.replyTo.username:'Add a comment... @friend'}" autocomplete="off" /><div class="mention-choices" hidden></div></div><input type="hidden" name="parent_id" value="${a(m.replyTo?.id||'')}" /><button type="submit">Post</button></form>`:'<div class="comment-closed">This account limits who can comment.</div>'}</div></div></div>`;
  }
  if(m.type==='story') {
    const st=S.storyItems[S.storyPointer]; if(!st) return '';
    const p=getProfile(st.user_id)||{};
    return `<div class="story-backdrop" data-action="close-modal"><div class="story-dialog" role="dialog" aria-modal="true"><div class="story-bars">${S.storyItems.map((_,i)=>`<span class="${i<=S.storyPointer?'done':''}"></span>`).join('')}</div><div class="story-top"><button data-action="profile" data-id="${p.id}">${avatar(p,'sm')}<b>${h(p.username)}</b><small>${niceTime(st.created_at)}</small></button>${close}</div>${st.media_type==='video'?dataVid(st.storage_path,'story-full'):dataImg(st.storage_path,'Story','story-full')}<div class="story-overlay-caption">${h(st.caption||'')}</div><button class="story-left" data-action="story-prev" aria-label="Previous story"></button><button class="story-right" data-action="story-next" aria-label="Next story"></button><div class="story-controls">${st.user_id===uid()?`<div class="story-owner-actions"><button type="button" data-action="story-toggle-insights">${I('eye',18)} ${num(S.storyStats.get(st.id)?.views?.length||0)} views · ${num(S.storyStats.get(st.id)?.likes?.length||0)} likes</button><button type="button" data-action="edit-story" data-id="${st.id}">${I('pencil',18)} Edit</button><button type="button" class="danger" data-action="delete-story" data-id="${st.id}">${I('trash-2',18)} Delete</button></div>`:`<button type="button" class="story-like-btn ${S.storyStats.get(st.id)?.liked?'is-liked':''}" data-action="story-like" data-id="${st.id}">${I('heart',22)} ${S.storyStats.get(st.id)?.liked?'Liked':'Like story'}</button>`}</div>${S.storyInsightsOpen&&st.user_id===uid()?`<div class="story-insights-panel"><h3>Story insights</h3><p><b>${num(S.storyStats.get(st.id)?.views?.length||0)}</b> unique views · <b>${num(S.storyStats.get(st.id)?.likes?.length||0)}</b> likes</p><h4>Viewed by</h4>${peopleInsightMarkup((S.storyStats.get(st.id)?.views||[]).map(getProfile).filter(Boolean),'No one has viewed your story yet.')}<h4>Liked by</h4>${peopleInsightMarkup((S.storyStats.get(st.id)?.likes||[]).map(getProfile).filter(Boolean),'No likes yet.')}</div>`:''}</div></div>`;
  }
  if(m.type==='post-insights') {
    const p=S.posts.get(m.postId);
    return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog insights-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">POST INSIGHTS</span><h2>Engagement</h2></div>${close}</div><div class="insight-cards"><div><strong>${num(m.viewsCount||0)}</strong><span>${I('eye',16)} Unique viewers</span></div><div><strong>${num(m.likesCount||0)}</strong><span>${I('heart',16)} Likes</span></div><div><strong>${num(p?.commentCount||0)}</strong><span>${I('message-circle',16)} Comments</span></div></div><h3>People who viewed</h3>${peopleInsightMarkup(m.viewers||[],'No viewers yet.')}<h3>People who liked</h3>${peopleInsightMarkup(m.likers||[],'No likes yet.')}<p class="muted small insight-note">Unique views count signed-in accounts whose posts appeared on screen. Only you can see the viewer list.</p></div></div>`;
  }
  if(m.type==='edit-post') {
    const post=S.posts.get(m.postId);if(!post)return '';
    return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Edit post</h2>${close}</div><form data-form="edit-post"><input type="hidden" name="postId" value="${a(post.id)}"/><label>Caption<textarea name="caption" maxlength="2200" rows="5">${h(post.caption||'')}</textarea></label><label>Location<input name="location" maxlength="140" value="${a(post.location||'')}"/></label><button type="submit" class="primary-btn btn-full">Save changes</button></form></div></div>`;
  }
  if(m.type==='edit-story') {
    const st=S.stories.find(x=>x.id===m.storyId);
    if(!st)return '';
    return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Edit your story</h2>${close}</div><form data-form="edit-story"><input type="hidden" name="storyId" value="${a(st.id)}"/><label>Caption<textarea name="caption" maxlength="250" rows="4">${h(st.caption||'')}</textarea></label><label>Replace photo or video (optional)<input type="file" id="story-replacement" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"/></label><p class="muted small">The story still expires 24 hours after its original upload. Replacing media keeps existing views and likes.</p><button type="submit" class="primary-btn btn-full">Save story</button></form></div></div>`;
  }
  if(m.type==='post-options') {
    const post=S.posts.get(m.postId);return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog options-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Post options</h2>${close}</div><button class="settings-link" data-action="share" data-id="${post.id}">${I('link',21)} Share post</button>${post.user_id===uid()?`<button class="settings-link" data-action="post-insights" data-id="${post.id}">${I('eye',21)} View insights</button><button class="settings-link" data-action="edit-post" data-id="${post.id}">${I('pencil',21)} Edit caption & location</button><button class="settings-link danger" data-action="delete-post" data-id="${post.id}">${I('trash-2',21)} Delete post</button>`:''}</div></div>`;
  }
  if(m.type==='profile-options') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog options-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>Account options</h2>${close}</div><button class="settings-link danger" data-action="block" data-id="${m.userId}">${I('shield-ban',21)} Block this account</button></div></div>`;
  if(m.type==='share-post'){
    const item=S.posts.get(m.postId),people=(m.filtered||[...S.people.values()]).filter(p=>p.id!==uid()&&!S.blocked.has(p.id)).slice(0,35);
    return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog share-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">SEND IN VIBRA</span><h2>Share ${item?.is_reel?'reel':'post'} with friends</h2></div>${close}</div><div class="large-search tiny-search">${I('search',20)}<input id="share-search" placeholder="Search username..." autocomplete="off" /></div><div class="share-people" id="share-targets">${shareTargetMarkup(people,m.postId)}</div><div class="share-footer"><button class="outline-btn" data-action="copy-share-link" data-id="${a(m.postId)}">${I('link',17)} Copy link</button><p class="muted small">Private reels can only be sent to accounts allowed to view them.</p></div></div></div>`;
  }
  if(m.type==='new-chat') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><div><span class="eyebrow">START A CONVERSATION</span><h2>New message</h2></div>${close}</div><div class="large-search tiny-search">${I('search',20)}<input id="dm-search" placeholder="Search a username" /></div><div id="dm-results" class="result-list">${[...S.people.values()].filter(p=>p.id!==uid()).slice(0,20).map(p=>`<button data-action="dm-user" data-id="${p.id}" class="result-user">${avatar(p)}<span><strong>${h(p.username)}</strong><small>${h(name(p))}</small></span>${I('send',17)}</button>`).join('')}</div></div></div>`;
  if(m.type==='follow-list') return `<div class="modal-backdrop" data-action="close-modal"><div class="dialog small-dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>${h(m.label)}</h2>${close}</div><div class="result-list">${m.people?.length?m.people.map(p=>`<button class="result-user" data-action="profile" data-id="${p.id}">${avatar(p)}<span><strong>${h(p.username)}</strong><small>${h(name(p))}</small></span>${I('chevron-right',19)}</button>`).join(''):'<p class="muted">No accounts to show.</p>'}</div></div></div>`;
  return '';
}
function showModal(type, rest={}) { S.modal={type,...rest}; if(S.view==='reels')document.querySelectorAll('.reel-vid').forEach(v=>v.pause()); refreshModal(); }
function refreshModal() {
  if(!S.user) return;
  const root=document.getElementById('modal-root');
  if(root) { root.innerHTML=modalMarkup(); icons(); hydrateMedia(root); }
}
function closeModal() {
  if(S.previewFiles.length) S.previewFiles.forEach(x=>URL.revokeObjectURL(x.url));
  S.previewFiles=[]; S.busy=false; S.modal=null; refreshModal();
}

// ────────── Supabase queries ──────────
function check(res){ if(res.error) throw res.error; return res.data||[]; }
async function ensureProfiles(ids) {
  const missing=[...new Set((ids||[]).filter(Boolean))].filter(id=>!S.people.has(id));
  if(!missing.length) return;
  for(let i=0;i<missing.length;i+=80) {
    const people=check(await db.from('profiles').select('*').in('id',missing.slice(i,i+80)));
    people.forEach(p=>S.people.set(p.id,{...S.people.get(p.id),...p}));
  }
}
async function fetchMe() {
  const {data,error}=await db.from('profiles').select('*').eq('id',uid()).maybeSingle();
  if(error)throw error;
  if(!data)throw Error('Your profile is not ready yet. Please try signing out and signing in again.');
  S.me=data; S.people.set(data.id,{...S.people.get(data.id),...data});
}
async function fetchRelations() {
  const [f,b]=await Promise.all([
    db.from('follows').select('following_id,status').eq('follower_id',uid()),
    db.from('blocks').select('blocked_id').eq('blocker_id',uid())
  ]);
  S.following=new Map(check(f).map(x=>[x.following_id,x.status]));
  S.blocked=new Set(check(b).map(x=>x.blocked_id));
}
async function hydratePosts(rows) {
  if(!rows.length)return [];
  const ids=rows.map(x=>x.id);
  const [med,li,com,saved]=await Promise.all([
    db.from('post_media').select('*').in('post_id',ids).order('position'),
    db.from('likes').select('post_id,user_id').in('post_id',ids),
    db.from('comments').select('post_id').in('post_id',ids),
    db.from('saved_posts').select('post_id').eq('user_id',uid()).in('post_id',ids)
  ]);
  const media=check(med), likes=check(li), comments=check(com), savedIds=check(saved);
  ids.forEach(id=>S.saved.delete(id));
  savedIds.forEach(x=>S.saved.add(x.post_id));
  const out=rows.map(row=>{
    const prior=S.posts.get(row.id);
    const p={...row,media:media.filter(x=>x.post_id===row.id),slide:prior?.slide||0,
      liked:likes.some(l=>l.post_id===row.id&&l.user_id===uid()),
      likeCount:likes.filter(l=>l.post_id===row.id).length,
      commentCount:comments.filter(c=>c.post_id===row.id).length};
    S.posts.set(p.id,p);return p;
  });
  await ensureProfiles(rows.map(x=>x.user_id));
  return out;
}
async function fetchFeed() {
  const rows=check(await db.from('posts').select('*').order('created_at',{ascending:false}).limit(45));
  S.feed=await hydratePosts(rows);
}
async function fetchExplore() {
  const rows=check(await db.from('posts').select('*').order('created_at',{ascending:false}).limit(60));
  S.explore=await hydratePosts(rows);
}
async function fetchReels() {
  const rows=check(await db.from('posts').select('*').eq('is_reel',true).order('created_at',{ascending:false}).limit(40));
  S.reels=await hydratePosts(rows);
}
async function fetchStories() {
  const rows=check(await db.from('stories').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(100));
  S.stories=rows;
  await ensureProfiles(rows.map(x=>x.user_id));
}
async function fetchSuggestions() {
  const rows=check(await db.from('profiles').select('*').neq('id',uid()).order('created_at',{ascending:false}).limit(30));
  rows.forEach(p=>S.people.set(p.id,{...S.people.get(p.id),...p}));
  S.suggestions=rows.filter(p=>!S.following.has(p.id)&&!S.blocked.has(p.id)).slice(0,8);
}
async function fetchNotifications() {
  const rows=check(await db.from('notifications').select('*').eq('user_id',uid()).order('created_at',{ascending:false}).limit(75));
  S.notifications=rows; await ensureProfiles(rows.map(x=>x.actor_id));
}
async function fetchConversations() {
  const id=uid();
  const rows=check(await db.from('conversations').select('*').or(`created_by.eq.${id},recipient_id.eq.${id}`).order('created_at',{ascending:false}).limit(120));
  S.chatSummaries=new Map();
  if(rows.length){
    const previews=check(await db.from('messages').select('id,conversation_id,sender_id,body,media_type,shared_post_id,created_at,read_at').in('conversation_id',rows.map(c=>c.id)).order('created_at',{ascending:false}).limit(500));
    previews.forEach(m=>{
      const old=S.chatSummaries.get(m.conversation_id)||{unread:0,last:null};
      if(!old.last)old.last=m;
      if(m.sender_id!==uid()&&!m.read_at)old.unread++;
      S.chatSummaries.set(m.conversation_id,old);
    });
    rows.sort((a,b)=>new Date(S.chatSummaries.get(b.id)?.last?.created_at||b.created_at)-new Date(S.chatSummaries.get(a.id)?.last?.created_at||a.created_at));
  }
  S.conversations=rows; await ensureProfiles(rows.flatMap(c=>[c.created_by,c.recipient_id]));
}
async function fetchMessages(id) {
  const rows=check(await db.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:true}).limit(200));
  S.messages=rows;
  const related=[...new Set(rows.map(m=>m.shared_post_id).filter(Boolean))].filter(id=>!S.posts.has(id));
  if(related.length){const posts=check(await db.from('posts').select('*').in('id',related).limit(100));await hydratePosts(posts);}
  const {error}=await db.from('messages').update({read_at:new Date().toISOString()}).eq('conversation_id',id).neq('sender_id',uid()).is('read_at',null);
  if(error)console.warn('Could not mark messages read:',error.message);
}
async function fetchSavedPosts() {
  const rows=check(await db.from('saved_posts').select('post_id').eq('user_id',uid()).order('created_at',{ascending:false}).limit(120));
  const ids=rows.map(r=>r.post_id);S.saved=new Set(ids);
  if(!ids.length)return;
  const visible=check(await db.from('posts').select('*').in('id',ids));
  await hydratePosts(visible);
}
async function loadProfileView(id) {
  if(!id)return;
  const fresh=check(await db.from('profiles').select('*').eq('id',id).limit(1));
  if(fresh[0]){S.people.set(id,{...S.people.get(id),...fresh[0]});if(id===uid())S.me=S.people.get(id);}
  else await ensureProfiles([id]);
  const [posts,followers,following]=await Promise.all([
    db.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(90),
    db.from('follows').select('*',{count:'exact',head:true}).eq('following_id',id).eq('status','accepted'),
    db.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',id).eq('status','accepted')
  ]);
  check(posts); if(followers.error)throw followers.error; if(following.error)throw following.error;
  await hydratePosts(posts.data||[]);
  const p=S.people.get(id); if(p){p.followersCount=followers.count||0;p.followingCount=following.count||0;}
}
function rememberScreenInHistory(view){
  if(!S.user)return;
  try {
    const current=history.state&&typeof history.state==='object'?history.state:{};
    if(!current.vibraScreen)history.replaceState({...current,vibraScreen:'home'},'',location.href);
    if(history.state?.vibraScreen===view)return;
    if(view==='home')history.replaceState({...history.state,vibraScreen:'home'},'',location.href);
    else if(history.state?.vibraScreen==='home')history.pushState({...history.state,vibraScreen:view},'',location.href);
    else history.replaceState({...history.state,vibraScreen:view},'',location.href);
  }catch(e){console.warn('Navigation history unavailable:',e);}
}
async function loadScreen(view,{fromHistory=false}={}) {
  if(!fromHistory)rememberScreenInHistory(view);
  if(S.view==='reels' && view!=='reels') {
    document.querySelectorAll('.reel-vid').forEach(video=>video.pause());
    S.reelObserver?.disconnect();
    S.reelPausedByUser.clear();
  }
  if(view==='reels'&&S.view!=='reels')S.reelPausedByUser.clear();
  const token=++S.screenToken;
  S.view=view; S.modal=null; S.loading=true; render();
  try {
    if(view==='home') await Promise.all([fetchFeed(),fetchStories(),fetchSuggestions()]);
    if(view==='explore') await fetchExplore();
    if(view==='reels') await fetchReels();
    if(view==='profile') { await loadProfileView(S.viewUser||uid()); if(!S.viewUser && S.profileTab==='saved') await fetchSavedPosts(); }
    if(view==='messages') await fetchConversations();
    if(view==='notifications') await fetchNotifications();
    if(view==='search') await doSearch(S.searchText);
  } catch(e) {onError(e);}
  if(token===S.screenToken){S.loading=false;render(); if(view==='messages'&&S.activeChat) scrollChat();}
}
async function showProfile(id) { closeModal();S.viewUser=id||uid();S.profileTab='posts';await loadScreen('profile'); }
async function navigate(view) {
  if(view==='create'){showModal('create');return;}
  S.viewUser=null;
  S.activeChat=view==='messages'?S.activeChat:null;
  await loadScreen(view);
}
async function doSearch(q) {
  if(!db||!q?.trim()){S.searchResults=[];S.searchPosts=[];return;}
  const term=q.trim().slice(0,80);
  const txt=term.startsWith('#')?term:term.replace(/^@/,'');
  const [persons,posts]=await Promise.all([
    db.from('profiles').select('*').or(`username.ilike.%${escapeFilter(txt)}%,display_name.ilike.%${escapeFilter(txt)}%`).limit(24),
    db.from('posts').select('*').ilike('caption',`%${txt}%`).limit(24)
  ]);
  const ps=check(persons);ps.forEach(p=>S.people.set(p.id,{...S.people.get(p.id),...p}));
  S.searchResults=ps;S.searchPosts=await hydratePosts(check(posts));
}
function escapeFilter(s){return s.replace(/[^\p{L}\p{N}_ ]/gu,'').slice(0,70);}
async function openComments(postId) {
  if(!S.posts.has(postId)) {
    const {data,error}=await db.from('posts').select('*').eq('id',postId).maybeSingle();
    if(error)throw error;if(!data)throw Error('Post not found or not accessible');
    await hydratePosts([data]);
  }
  const rows=check(await db.from('comments').select('*').eq('post_id',postId).order('created_at',{ascending:true}).limit(250));
  await ensureProfiles(rows.map(x=>x.user_id));
  showModal('comments',{postId,comments:rows,replyTo:null});
  markPostSeen(postId).catch(console.warn);
}
async function openStory(userId) {
  S.storyItems=S.stories.filter(x=>x.user_id===userId).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(!S.storyItems.length)return;
  S.storyPointer=0;S.storyInsightsOpen=false;showModal('story');await storyViewed();await loadStoryStats(S.storyItems[0].id);
}
async function storyViewed() {
  const st=S.storyItems[S.storyPointer];if(!st||st.user_id===uid())return;
  const {error}=await db.from('story_views').upsert({story_id:st.id,user_id:uid()},{onConflict:'story_id,user_id',ignoreDuplicates:true});
  if(error)console.warn(error.message);
}
async function storyMove(dir) {const next=S.storyPointer+dir;if(next<0||next>=S.storyItems.length){closeModal();return;}S.storyPointer=next;S.storyInsightsOpen=false;refreshModal();await storyViewed();await loadStoryStats(S.storyItems[next].id);}
async function loadStoryStats(storyId) {
  const st=S.stories.find(x=>x.id===storyId);if(!st)return;
  if(st.user_id===uid()){
    const [v,l]=await Promise.all([db.from('story_views').select('user_id').eq('story_id',storyId).limit(250),db.from('story_likes').select('user_id').eq('story_id',storyId).limit(250)]);
    const views=check(v).map(x=>x.user_id),likes=check(l).map(x=>x.user_id);
    S.storyStats.set(storyId,{views,likes,liked:false});await ensureProfiles([...views,...likes]);
  }else{
    const {data,error}=await db.from('story_likes').select('user_id').eq('story_id',storyId).eq('user_id',uid()).maybeSingle();
    if(error)throw error;S.storyStats.set(storyId,{views:[],likes:[],liked:!!data});
  }
  if(S.modal?.type==='story'&&S.storyItems[S.storyPointer]?.id===storyId)refreshModal();
}
async function toggleStoryLike(storyId){
  const st=S.stories.find(x=>x.id===storyId);if(!st||st.user_id===uid())return;
  const prior=S.storyStats.get(storyId)?.liked||false;
  const res=prior?await db.from('story_likes').delete().eq('story_id',storyId).eq('user_id',uid()):await db.from('story_likes').insert({story_id:storyId,user_id:uid()});
  if(res.error)throw res.error;
  S.storyStats.set(storyId,{views:[],likes:[],liked:!prior});refreshModal();
}
async function deleteStory(id){
  const st=S.stories.find(x=>x.id===id);if(!st||st.user_id!==uid())return;
  if(!confirm('Delete this story permanently?'))return;
  check(await db.from('stories').delete().eq('id',id));
  await db.storage.from('media').remove([st.storage_path]).catch(console.warn);
  S.stories=S.stories.filter(x=>x.id!==id);S.storyStats.delete(id);
  closeModal();toast('Story deleted');render();
}
async function updateStory(form){
  const id=form.get('storyId'),st=S.stories.find(x=>x.id===id);if(!st||st.user_id!==uid())throw Error('Story not found');
  const file=document.getElementById('story-replacement')?.files?.[0];let newPath=null;
  try{
    const oldPath=st.storage_path;
    if(file)newPath=await upload(file);
    const change={caption:String(form.get('caption')||'').trim()};
    if(newPath){change.storage_path=newPath;change.media_type=file.type.startsWith('video/')?'video':'image';}
    const {data,error}=await db.from('stories').update(change).eq('id',id).select('*').single();if(error)throw error;
    Object.assign(st,data);
    if(newPath){S.signed.delete(oldPath);await db.storage.from('media').remove([oldPath]);}
    // Delete old media after the database update, never before it.
    closeModal();toast('Story updated');await openStory(st.user_id);
    const idx=S.storyItems.findIndex(x=>x.id===id);if(idx>=0&&idx!==S.storyPointer){S.storyPointer=idx;refreshModal();await loadStoryStats(id);}
  }catch(e){if(newPath)await db.storage.from('media').remove([newPath]);throw e;}
}
async function updatePost(form){
  const id=form.get('postId'),post=S.posts.get(id);if(!post||post.user_id!==uid())throw Error('Post not found');
  const {data,error}=await db.from('posts').update({caption:String(form.get('caption')||'').trim(),location:String(form.get('location')||'').trim()}).eq('id',id).select('*').single();
  if(error)throw error;Object.assign(post,data);closeModal();toast('Post updated');render();
}
async function postInsights(postId){
  const p=S.posts.get(postId);if(!p||p.user_id!==uid())throw Error('Only the post owner can view insights');
  const [v,l]=await Promise.all([
    db.from('post_views').select('user_id',{count:'exact'}).eq('post_id',postId).order('viewed_at',{ascending:false}).limit(150),
    db.from('likes').select('user_id',{count:'exact'}).eq('post_id',postId).order('created_at',{ascending:false}).limit(150)
  ]);
  const views=check(v),likes=check(l);await ensureProfiles([...views,...likes].map(x=>x.user_id));
  showModal('post-insights',{postId,viewsCount:v.count||0,likesCount:l.count||0,viewers:views.map(x=>getProfile(x.user_id)).filter(Boolean),likers:likes.map(x=>getProfile(x.user_id)).filter(Boolean)});
}
async function markPostSeen(id){
  if(!uid()||S.postSeen.has(id))return;
  const p=S.posts.get(id);if(!p||p.user_id===uid())return;
  S.postSeen.add(id);
  const {error}=await db.from('post_views').upsert({post_id:id,user_id:uid()},{onConflict:'post_id,user_id',ignoreDuplicates:true});
  if(error){S.postSeen.delete(id);console.warn('Could not record post view:',error.message);}
}
function installPostObserver(){
  if(S.postObserver)S.postObserver.disconnect();
  if(!('IntersectionObserver' in window)||!uid())return;
  S.postObserver=new IntersectionObserver(entries=>{
    entries.filter(x=>x.isIntersecting&&x.intersectionRatio>=.6).forEach(x=>{
      const id=x.target.dataset.postId;
      if(!id||S.postSeen.has(id))return;
      S.postObserver.unobserve(x.target);
      setTimeout(()=>{if(S.user&&S.posts.has(id))markPostSeen(id).catch(console.warn);},650);
    });
  },{threshold:[.6]});
  document.querySelectorAll('.post-card[data-post-id]').forEach(x=>S.postObserver.observe(x));
}
async function updatePrivacy(key,value){
  const options={comment_privacy:['everyone','followers','off'],message_privacy:['everyone','followers','none'],story_audience:['everyone','followers']};
  if(!options[key]?.includes(value))throw Error('Invalid privacy setting');
  const {data,error}=await db.from('profiles').update({[key]:value,updated_at:new Date().toISOString()}).eq('id',uid()).select('*').single();
  if(error)throw error;S.me=data;S.people.set(uid(),{...S.people.get(uid()),...data});toast('Privacy updated');refreshModal();
}
async function decideRequest(id,status){
  if(!['accepted','declined'].includes(status))throw Error('Invalid request action');
  const conv=S.conversations.find(x=>x.id===id);if(!conv||conv.recipient_id!==uid())throw Error('Request not found');
  const {error}=await db.from('conversations').update({status}).eq('id',id).eq('recipient_id',uid());
  if(error)throw error;
  if(status==='declined')S.activeChat=null;
  await fetchConversations();if(status==='accepted'&&S.activeChat===id)await fetchMessages(id);
  toast(status==='accepted'?'Message request accepted':'Message request declined');render();
}
async function installApp(){
  // Works even when the app is still loading; install event was captured by pwa.js in <head>.
  if (window.VibraInstall) return window.VibraInstall.open();
  alert('Please open Vibra on its HTTPS website in Chrome or Safari to install.');
}

async function viewFollowList(id,type) {
  const col=type==='followers'?'following_id':'follower_id';
  const rows=check(await db.from('follows').select('follower_id,following_id').eq(col,id).eq('status','accepted').limit(100));
  const ids=rows.map(x=>type==='followers'?x.follower_id:x.following_id);
  await ensureProfiles(ids);showModal('follow-list',{label:type==='followers'?'Followers':'Following',people:ids.map(getProfile).filter(Boolean)});
}
async function followUser(id) {
  if(!id||id===uid())return;
  const current=S.following.get(id);
  if(current) {check(await db.from('follows').delete().eq('follower_id',uid()).eq('following_id',id));S.following.delete(id);toast(current==='pending'?'Request withdrawn':'Unfollowed');}
  else {const result=await db.from('follows').insert({follower_id:uid(),following_id:id}).select('status').single();if(result.error)throw result.error;S.following.set(id,result.data.status);toast(result.data.status==='pending'?'Follow request sent':'Following!');}
  S.suggestions=S.suggestions.filter(p=>p.id!==id);
  if(S.view==='profile'&&(S.viewUser||uid())===id) await loadProfileView(id);
  render();
}
async function acceptFollow(id) {
  check(await db.from('follows').update({status:'accepted'}).eq('follower_id',id).eq('following_id',uid()));
  toast('Follow request accepted');
  await fetchNotifications();render();
}
function updateReactionDisplay(id){
  if(S.view!=='reels')return false;
  const card=[...document.querySelectorAll('.reel-item')].find(item=>item.dataset.reelId===id);
  if(!card)return false;
  const p=S.posts.get(id), like=card.querySelector('[data-action="like"]'),save=card.querySelector('[data-action="save"]');
  like?.classList.toggle('is-liked',!!p?.liked);
  const count=like?.querySelector('span');if(count)count.textContent=num(p?.likeCount||0);
  save?.classList.toggle('is-saved',S.saved.has(id));
  return true;
}
async function toggleLike(id) {
  const p=S.posts.get(id);if(!p)return;
  const prior=p.liked;p.liked=!prior;p.likeCount=Math.max(0,(p.likeCount||0)+(prior?-1:1));
  if(!updateReactionDisplay(id))render();
  const result=prior?await db.from('likes').delete().eq('post_id',id).eq('user_id',uid()):await db.from('likes').insert({post_id:id,user_id:uid()});
  if(result.error){p.liked=prior;p.likeCount=Math.max(0,(p.likeCount||0)+(prior?1:-1));if(!updateReactionDisplay(id))render();throw result.error;}
}
async function toggleSaved(id) {
  const old=S.saved.has(id);old?S.saved.delete(id):S.saved.add(id);
  if(!updateReactionDisplay(id))render();
  const res=old?await db.from('saved_posts').delete().eq('post_id',id).eq('user_id',uid()):await db.from('saved_posts').insert({post_id:id,user_id:uid()});
  if(res.error){old?S.saved.add(id):S.saved.delete(id);if(!updateReactionDisplay(id))render();throw res.error;}
  toast(old?'Removed from saved':'Saved to your collection');
}
async function sendComment(postId,body,parent_id=null) {
  const clean=String(body||'').trim();
  if(!clean)throw Error('Write a comment first');
  // The parent-id validation happens in the database trigger, not a recursive RLS policy.
  const {data,error}=await db.from('comments').insert({post_id:postId,user_id:uid(),body:clean,parent_id:parent_id||null}).select('id').single();
  if(error)throw new Error(`${error.message}${error.code==='42501'?' — Check comment privacy and run supabase-upgrade-v2.sql.':''}`);
  if(!data?.id)throw Error('Comment was not saved');
  const p=S.posts.get(postId);if(p)p.commentCount=(p.commentCount||0)+1;
  await openComments(postId);
  toast('Comment posted');
}
async function deleteComment(id) {
  if(!confirm('Delete this comment?'))return;
  const postId=S.modal?.postId;check(await db.from('comments').delete().eq('id',id));
  const p=S.posts.get(postId);if(p)p.commentCount=Math.max(0,(p.commentCount||0)-1);
  await openComments(postId);toast('Comment deleted');
}
async function publishPost(form) {
  if(S.busy)return;
  const files=S.previewFiles.map(x=>x.file);
  if(!files.length)throw Error('Choose a photo or video first');
  if(S.uploadType==='reel'&&(!files[0].type.startsWith('video/')||files.length!==1))throw Error('Reels require one video file');
  if(S.uploadType!=='post'&&files.length!==1)throw Error('Choose a single file');
  if(files.length>10)throw Error('Maximum 10 files per post');
  S.busy=true;refreshModal();
  const stored=[];let createdPost=null;
  try {
    for(const file of files) stored.push({path:await upload(file),kind:file.type.startsWith('video/')?'video':'image'});
    if(S.uploadType==='story') {
      check(await db.from('stories').insert({user_id:uid(),storage_path:stored[0].path,media_type:stored[0].kind,caption:form.get('caption')?.trim()||''}));
      toast('Story shared for 24 hours!');
    } else {
      const result=await db.from('posts').insert({user_id:uid(),caption:form.get('caption')?.trim()||'',location:form.get('location')?.trim()||'',is_reel:S.uploadType==='reel'}).select('id').single();
      if(result.error)throw result.error;createdPost=result.data.id;
      check(await db.from('post_media').insert(stored.map((x,i)=>({post_id:createdPost,storage_path:x.path,media_type:x.kind,position:i}))));
      toast(S.uploadType==='reel'?'Reel published!':'Your moment is live!');
    }
    closeModal();await navigate('home');
  } catch(e) {
    if(createdPost)await db.from('posts').delete().eq('id',createdPost);
    if(stored.length)await db.storage.from('media').remove(stored.map(x=>x.path));
    throw e;
  } finally {S.busy=false;refreshModal();}
}
async function removePost(id) {
  if(!confirm('Permanently delete this post?'))return;
  const p=S.posts.get(id);if(!p||p.user_id!==uid())return;
  check(await db.from('posts').delete().eq('id',id));
  await db.storage.from('media').remove((p.media||[]).map(x=>x.storage_path));
  S.posts.delete(id);closeModal();toast('Post deleted');await loadScreen(S.view);
}
async function saveProfile(form) {
  if(S.busy)return; S.busy=true;
  try {
    const patch={display_name:(form.get('display_name')||'').trim(),username:(form.get('username')||'').trim().toLowerCase(),
      bio:(form.get('bio')||'').trim(),website:(form.get('website')||'').trim(),updated_at:new Date().toISOString()};
    if(!/^[a-z0-9_]{3,24}$/.test(patch.username))throw Error('Username: 3–24 lowercase letters, digits, or underscores');
    if(patch.website && safeLink(patch.website)==='#')throw Error('Enter a valid website URL');
    const file=document.getElementById('avatar-file')?.files?.[0];
    if(file) patch.avatar_path=await upload(file,'avatars');
    const res=await db.from('profiles').update(patch).eq('id',uid()).select('*').single();if(res.error)throw res.error;
    S.me=res.data; S.people.set(uid(),{...S.people.get(uid()),...res.data});
    closeModal();toast('Profile updated!');S.viewUser=null;await loadScreen('profile');
  } finally {S.busy=false;}
}
async function togglePrivate() {
  const next=!S.me.is_private;
  const res=await db.from('profiles').update({is_private:next}).eq('id',uid()).select('*').single();if(res.error)throw res.error;
  S.me=res.data;S.people.set(uid(),{...S.people.get(uid()),...res.data});
  refreshModal();toast(next?'Account is private':'Account is public');
}
async function blockUser(id) {
  if(!confirm('Block this account? They will not be able to see your posts or contact you.'))return;
  check(await db.from('blocks').insert({blocker_id:uid(),blocked_id:id}));
  await db.from('follows').delete().eq('follower_id',uid()).eq('following_id',id);
  await db.from('follows').delete().eq('follower_id',id).eq('following_id',uid());
  S.blocked.add(id);S.following.delete(id);closeModal();toast('Account blocked');await navigate('home');
}
async function unblockUser(id) {
  check(await db.from('blocks').delete().eq('blocker_id',uid()).eq('blocked_id',id));
  S.blocked.delete(id);refreshModal();toast('Account unblocked');
}
async function newChat(otherId) {
  if(!otherId||otherId===uid())return;
  const pair=[uid(),otherId].sort().join(':');
  let {data,error}=await db.from('conversations').select('*').eq('pair_key',pair).maybeSingle();
  if(error)throw error;
  if(!data){const r=await db.from('conversations').insert({created_by:uid(),recipient_id:otherId}).select('*').single();
    if(r.error){if(r.error.code!=='23505')throw r.error; const existing=await db.from('conversations').select('*').eq('pair_key',pair).single();if(existing.error)throw existing.error;data=existing.data;}else data=r.data;
  }
  if(data.status==='declined')throw Error('Your message request was declined');
  closeModal();S.inboxTab=data.recipient_id===uid()&&data.status==='pending'?'requests':'chats';S.activeChat=data.id;await loadScreen('messages');await openChat(data.id);
}
async function openChat(id) {
  S.activeChat=id;
  await fetchMessages(id);
  if(S.chatChannel)await db.removeChannel(S.chatChannel);
  S.chatChannel=db.channel(`vibra-dm-${id}`).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`conversation_id=eq.${id}`},async()=>{
    if(S.activeChat===id&&S.view==='messages'){try{await fetchMessages(id);await fetchConversations();render();scrollChat();}catch(e){console.warn(e);}}
  }).subscribe();
  render();scrollChat();
}
function scrollChat() {setTimeout(()=>{const e=document.getElementById('chat-scroll');if(e)e.scrollTop=e.scrollHeight;},50);}
async function sendMessage(body,file,sharedPostId=null) {
  if(!S.activeChat)throw Error('Select a conversation first');
  if(!body?.trim()&&!file&&!sharedPostId)throw Error('Write a message, attach a file, or share a reel');
  let path=null;
  try {
    if(file)path=await upload(file);
    check(await db.from('messages').insert({conversation_id:S.activeChat,sender_id:uid(),body:body.trim(),media_path:path,media_type:file?(file.type.startsWith('video/')?'video':'image'):null,shared_post_id:sharedPostId}));
    await fetchMessages(S.activeChat);await fetchConversations();render();scrollChat();
  } catch(e){if(path) await db.storage.from('media').remove([path]);throw e;}
}
async function sharePost(id){
 const post=S.posts.get(id);if(!post)throw Error('Post not found');
 if(S.people.size<5)await fetchSuggestions();
 showModal('share-post',{postId:id});
}
async function copyShareLink(id){
 const url=`${location.origin}${location.pathname}?post=${encodeURIComponent(id)}`;
 try{await navigator.clipboard.writeText(url);toast('Post link copied');}
 catch{window.prompt('Copy this link:',url);}
}
async function shareToUser(postId,friendId){
 if(!S.posts.has(postId))throw Error('Reel or post is not available');
 await newChat(friendId);
 await sendMessage('',null,postId);
 toast('Shared in your chat');
}
async function unsendMessage(id){
 const m=S.messages.find(x=>x.id===id);
 if(!m||m.sender_id!==uid())throw Error('You can only unsend your own messages');
 if(!confirm('Unsend this message for both people?'))return;
 const {error}=await db.from('messages').delete().eq('id',id).eq('sender_id',uid());if(error)throw error;
 if(m.media_path)await db.storage.from('media').remove([m.media_path]);
 await fetchMessages(S.activeChat);render();toast('Message unsent');
}
async function openSharedPost(id){
 if(!S.posts.has(id))throw Error('This post is unavailable or private');
 await openComments(id);
}
async function openUsername(username){
 const p=[...S.people.values()].find(p=>p.username?.toLowerCase()===username.toLowerCase());
 if(p){await showProfile(p.id);return;}
 const {data,error}=await db.from('profiles').select('id').eq('username',username.toLowerCase()).maybeSingle();
 if(error)throw error;if(!data)throw Error('Account not found');await showProfile(data.id);
}
async function switchAccount(){
 if(!confirm('Switch account? You will sign in to your other account.'))return;
 await signOut();S.authMode='login';renderAuth();toast('Choose an account and sign in');
}
async function readAllNotifications() {
  const {error}=await db.from('notifications').update({is_read:true}).eq('user_id',uid()).eq('is_read',false);
  if(error)throw error;S.notifications.forEach(x=>x.is_read=true);render();
}

// ────────── Auth and configuration ──────────
function renderSdkError() {
  app.innerHTML=`<main class="loading-screen"><div class="logo-mark">v.</div><h2>Could not load the Supabase client</h2><p>Check your internet connection and reload the page.</p><p class="muted">${h(sdkLoadError?.message||'CDN unavailable')}</p><button class="primary-btn" data-action="reload-app">Try again</button></main>`;
}
function renderSetup() {
  app.innerHTML=`<main class="setup-page"><div class="setup-left"><div class="auth-logo"><span class="brand-emblem">v.</span> vibra<span class="brand-dot">.</span></div><div class="setup-badge">${I('sparkles',16)} YOUR NEXT SOCIAL SPACE</div><h1>Every moment<br>deserves to <em>shine.</em></h1><p>Everything you need to create, connect, and share. A fresh social network powered by your own Supabase project.</p><div class="setup-highlights"><span>${I('shield-check',18)} Private, secure profiles</span><span>${I('images',18)} Photos, stories & reels</span><span>${I('messages-square',18)} Real-time messaging</span></div><div class="mock-social"><div class="mock-gradient"><span class="mock-sun">✦</span><span>your story starts here.</span></div><div class="mock-heart">${I('heart',25)}</div></div></div><section class="setup-right"><div class="setup-card"><span class="step-label">QUICK START · ABOUT 5 MINUTES</span><h2>Connect Supabase</h2><p>You'll need a Supabase project before accounts and posts can be saved.</p><ol class="setup-steps"><li><b>01</b><span>Create a project at <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer">supabase.com</a></span></li><li><b>02</b><span>Open its SQL Editor and run <code>supabase-schema.sql</code></span></li><li><b>03</b><span>Open <code>config.js</code> and add your Project URL and <strong>publishable</strong> key</span></li><li><b>04</b><span>Serve this folder over HTTP and reload the page</span></li></ol><div class="setup-warning">${I('info',19)} Never add a service_role or secret key to a public website.</div><p class="setup-foot">Full instructions in <strong>README.md</strong>.</p>${installButton('outline-btn auth-install-btn')}</div></section></main>`;
  icons();
}
function renderAuth() {
  const signup=S.authMode==='signup';
  app.innerHTML=`<main class="auth-layout"><section class="auth-showcase"><div class="auth-logo"><span class="brand-emblem">v.</span> vibra<span class="brand-dot">.</span></div><div class="showcase-content"><span class="showcase-tag">✦ A LITTLE MORE CONNECTED</span><h1>Life is better<br>when we <em>share it.</em></h1><p>A home for your favorite moments, the people you love, and everything in between.</p><div class="showcase-collage"><div class="collage-tall"><span>Collect moments.<br>Not things.</span></div><div class="collage-small one">${I('heart',36)}</div><div class="collage-small two">${I('sparkles',33)}</div></div></div><div class="showcase-footer">A place to be you. © ${new Date().getFullYear()} Vibra</div></section>
    <section class="auth-main"><div class="auth-card"><div class="auth-mobile-brand"><span class="brand-emblem">v.</span> vibra<span class="brand-dot">.</span></div><span class="eyebrow">WELCOME TO VIBRA</span><h2>${signup?'Create your account':'Good to have you back.'}</h2><p class="auth-subtitle">${signup?'Join a community made for the moments that matter.':'Your people and your favorite moments are waiting.'}</p><div class="auth-tabs"><button data-action="auth-mode" data-mode="login" class="${!signup?'selected':''}">Log in</button><button data-action="auth-mode" data-mode="signup" class="${signup?'selected':''}">Sign up</button></div>
    <form data-form="auth">${signup?`<label>Display name<input name="display_name" maxlength="80" required placeholder="Your name" autocomplete="name" /></label><label>Username<input name="username" maxlength="24" pattern="[a-zA-Z0-9_]{3,24}" required placeholder="your_username" autocomplete="username" /></label>`:''}<label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" value="${a(S.loginEmail||'')}" /></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="${signup?'new-password':'current-password'}" placeholder="At least 8 characters" /></label>${!signup?`<button type="button" class="forgot" data-action="forgot-password">Forgot password?</button>`:''}<button class="primary-btn btn-full auth-submit" type="submit">${signup?'Create account':'Log in'} ${I('arrow-right',18)}</button></form>
    <div class="recent-accounts">${!signup&&recentAccounts().length?`<small>RECENT ACCOUNTS</small><div>${recentAccounts().map(email=>`<button type="button" data-action="choose-account" data-email="${a(email)}">${I('circle-user-round',16)} ${h(email)}</button>`).join('')}</div>`:''}</div><div class="auth-divider"><span>or continue with</span></div><button class="google-btn" data-action="google-auth"><strong class="google-g">G</strong> Google</button><div class="auth-install">${installButton('outline-btn auth-install-btn')}</div><p class="auth-disclaimer">By continuing, you agree to use this social space respectfully. ${signup?'Check your email to confirm your account if verification is enabled.':''}</p></div></section></main>`;
  icons();
}
let currentBoot = null, bootUserId = null;
async function bootstrapUser(user) {
  if(!user)return;
  if(S.user?.id===user.id && S.me)return;
  if(currentBoot && bootUserId===user.id)return currentBoot;
  bootUserId=user.id;
  currentBoot=(async()=>{
    S.user=user;rememberAccount(user.email);S.me=null;S.people.clear();S.posts.clear();S.feed=[];S.explore=[];S.reels=[];S.stories=[];
    S.view='home';S.viewUser=null;S.storyStats.clear();S.postSeen.clear();S.activeChat=null;render();
    try {
      await fetchMe();
      await fetchRelations();
      await fetchNotifications();
      subscribeGlobal();
      await loadScreen('home');
      const q=new URLSearchParams(location.search).get('post');
      if(q && /^[0-9a-f-]{36}$/i.test(q)) await openComments(q);
    } catch(e){onError(e);render();}
  })();
  try{return await currentBoot;}finally{currentBoot=null;bootUserId=null;}
}
function subscribeGlobal() {
  if(S.channel)db.removeChannel(S.channel);
  S.channel=db.channel(`vibra-alerts-${uid()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${uid()}`},async()=>{
      try{await fetchNotifications();if(S.user)render();}catch(e){console.warn(e);}
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'follows',filter:`following_id=eq.${uid()}`},async()=>{
      await fetchMe().catch(()=>{});
      if(S.view==='profile')await loadProfileView(S.viewUser||uid()).catch(()=>{});
      if(S.user)render();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`recipient_id=eq.${uid()}`},async()=>{
      if(S.view==='messages'){try{await fetchConversations();render();}catch(e){console.warn(e);}}
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`created_by=eq.${uid()}`},async()=>{
      if(S.view==='messages'){try{await fetchConversations();render();}catch(e){console.warn(e);}}
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async()=>{
      if(S.view==='messages'){try{await fetchConversations();render();}catch(e){console.warn(e);}}
    }).subscribe();
}
async function signOut() {
  closeModal();
  if(S.channel)await db.removeChannel(S.channel);
  if(S.chatChannel)await db.removeChannel(S.chatChannel);
  const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;
  S.user=null;S.me=null;S.channel=null;S.chatChannel=null;S.people.clear();S.posts.clear();S.conversations=[];S.messages=[];S.chatSummaries.clear();S.activeChat=null;S.following.clear();S.blocked.clear();S.saved.clear();S.storyStats.clear();S.postSeen.clear();S.signed.clear();render();
}

// ────────── Input events ──────────
document.addEventListener('click', async e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action,id=btn.dataset.id;
  // The dimmed backdrop closes a modal, but clicks on the dialog itself must not.
  if(action==='close-modal' && (btn.classList.contains('modal-backdrop')||btn.classList.contains('story-backdrop')) && e.target!==btn)return;
  e.preventDefault();
  try {
    switch(action) {
      case 'reload-app':location.reload();break;
      case 'auth-mode': S.authMode=btn.dataset.mode;render();break;
      case 'forgot-password': {
        const email=document.querySelector('[name=email]')?.value?.trim();
        if(!email)throw Error('Enter your email address first');
        const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('?')[0]});if(error)throw error;
        toast('Password reset link sent, if the account exists');break;
      }
      case 'google-auth': {const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('?')[0]}});if(error)throw error;break;}
      case 'nav':await navigate(btn.dataset.view||'home');break;
      case 'toggle-reel':toggleReel(id);break;
      case 'profile':await showProfile(id);break;
      case 'open-create': S.uploadType=btn.dataset.type||'post';S.previewFiles=[];showModal('create');break;
      case 'upload-type': S.uploadType=btn.dataset.type;S.previewFiles.forEach(x=>URL.revokeObjectURL(x.url));S.previewFiles=[];refreshModal();break;
      case 'close-modal':closeModal();break;
      case 'edit-profile':showModal('edit');break;
      case 'open-settings':showModal('settings');break;
      case 'install-app':await installApp();break;
      case 'inbox-tab':S.inboxTab=btn.dataset.tab==='requests'?'requests':'chats';S.activeChat=null;S.messages=[];render();break;
      case 'request-decision':await decideRequest(id,btn.dataset.status);break;
      case 'toggle-theme':S.light=!S.light;try{localStorage.setItem('vibra-theme',S.light?'light':'dark');}catch{}paint();break;
      case 'toggle-private':await togglePrivate();break;
      case 'blocked-list':showModal('blocked');break;
      case 'change-password':showModal('password');break;
      case 'logout':await signOut();break;
      case 'switch-account':await switchAccount();break;
      case 'choose-account':S.loginEmail=btn.dataset.email;renderAuth();document.querySelector('.auth-card input[name=password]')?.focus();break;
      case 'share-to-user':await shareToUser(btn.dataset.post,id);break;
      case 'copy-share-link':await copyShareLink(id);break;
      case 'unsend-message':await unsendMessage(id);break;
      case 'open-shared-post':await openSharedPost(id);break;
      case 'profile-username':await openUsername(btn.dataset.username);break;
      case 'pick-mention':{const box=btn.closest('.mention-root'),input=box?.querySelector('[data-mention-input]');if(input){const before=input.value.slice(0,input.selectionStart),after=input.value.slice(input.selectionStart),m=before.match(/(^|\s)@([a-z0-9_]{0,24})$/i);if(m){const newBefore=before.slice(0,before.length-m[2].length-1)+ '@'+btn.dataset.username+' ';input.value=newBefore+after;input.focus();input.setSelectionRange(newBefore.length,newBefore.length);box.querySelector('.mention-choices').hidden=true;}}break;}
      case 'profile-options':showModal('profile-options',{userId:id});break;
      case 'block':await blockUser(id);break;
      case 'unblock':await unblockUser(id);break;
      case 'follow':await followUser(id);break;
      case 'accept-follow':await acceptFollow(id);break;
      case 'follow-list':await viewFollowList(id,btn.dataset.type);break;
      case 'feed-filter':S.feedMode=btn.dataset.filter;render();break;
      case 'profile-tab':S.profileTab=btn.dataset.tab;if(S.profileTab==='saved')await loadScreen('profile');else render();break;
      case 'like':await toggleLike(id);break;
      case 'save':await toggleSaved(id);break;
      case 'comments':await openComments(id);break;
      case 'post-options':showModal('post-options',{postId:id});break;
      case 'post-insights':await postInsights(id);break;
      case 'edit-post':showModal('edit-post',{postId:id});break;
      case 'delete-post':await removePost(id);break;
      case 'share':await sharePost(id);break;
      case 'slide':{const p=S.posts.get(id);if(p){p.slide=Math.min(p.media.length-1,Math.max(0,(p.slide||0)+Number(btn.dataset.dir)));render();}break;}
      case 'reply':{if(S.modal?.type==='comments'){S.modal.replyTo={id,username:btn.dataset.username};refreshModal();const input=document.querySelector('.detail-reply input[name=body]');if(input){input.value=`@${btn.dataset.username} `;input.focus();}}break;}
      case 'delete-comment':await deleteComment(id);break;
      case 'view-story':await openStory(id);break;
      case 'story-like':await toggleStoryLike(id);break;
      case 'story-toggle-insights':S.storyInsightsOpen=!S.storyInsightsOpen;refreshModal();break;
      case 'edit-story':showModal('edit-story',{storyId:id});break;
      case 'delete-story':await deleteStory(id);break;
      case 'story-prev':await storyMove(-1);break;
      case 'story-next':await storyMove(1);break;
      case 'tag':S.searchText=btn.dataset.tag;await navigate('search');break;
      case 'read-all':await readAllNotifications();break;
      case 'new-chat':showModal('new-chat');break;
      case 'dm-user':await newChat(id);break;
      case 'open-chat':await openChat(id);break;
      case 'close-chat':S.activeChat=null;render();break;
      case 'notification-post':closeModal();await openComments(id);break;
      case 'notification-chat':closeModal();await navigate('messages');await openChat(id);break;
    }
  } catch(err){onError(err);}
});

document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();
  const kind=form.dataset.form, values=new FormData(form);
  const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
  try {
    if(kind==='auth'){
      const email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');
      if(S.authMode==='signup'){
        const username=String(values.get('username')||'').trim().toLowerCase();
        if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Username must be 3–24 letters, digits, or underscores');
        const {data:existing,error:lookupError}=await db.from('profiles').select('id').eq('username',username).maybeSingle();
        if(lookupError)throw lookupError;if(existing)throw Error('Username already taken');
        const {data,error}=await db.auth.signUp({email,password,options:{data:{username,display_name:String(values.get('display_name')||'').trim()},emailRedirectTo:location.href.split('?')[0]}});
        if(error)throw error;
        if(!data.session){toast('Check your email to confirm your account');S.authMode='login';render();}
        else await bootstrapUser(data.user);
      } else {
        const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;rememberAccount(email);
        await bootstrapUser(data.user);
      }
    }
    if(kind==='create') await publishPost(values);
    if(kind==='edit-profile') await saveProfile(values);
    if(kind==='edit-story') await updateStory(values);
    if(kind==='edit-post') await updatePost(values);
    if(kind==='new-password') {
      const {error}=await db.auth.updateUser({password:String(values.get('password'))});if(error)throw error;
      closeModal();toast('Password updated');
    }
    if(kind==='comment') {const body=String(values.get('body')||'').trim();if(!body)return;await sendComment(form.dataset.postId,body,values.get('parent_id'));}
    if(kind==='message') {const file=document.getElementById('chat-attachment')?.files?.[0];await sendMessage(String(values.get('body')||''),file);}
  }catch(err){onError(err);}finally{if(submit?.isConnected)submit.disabled=false;}
});

let searchTimer=null,searchId=0;
document.addEventListener('input', e=>{
  if(e.target.matches('[data-mention-input]'))mentionPicker(e.target);
  if(e.target.id==='share-search'){
    const term=e.target.value.trim().toLowerCase();const modal=S.modal;
    if(modal?.type==='share-post'){
      const matches=[...S.people.values()].filter(p=>p.id!==uid()&&!S.blocked.has(p.id)&&(p.username?.toLowerCase().includes(term)||p.display_name?.toLowerCase().includes(term))).slice(0,35);
      const host=document.getElementById('share-targets');if(host){host.innerHTML=shareTargetMarkup(matches,modal.postId);icons();hydrateMedia(host);}
      clearTimeout(searchTimer);if(term.length>=2){searchTimer=setTimeout(async()=>{try{
        const result=check(await db.from('profiles').select('*').ilike('username',`%${escapeFilter(term)}%`).limit(30));
        if(S.modal?.type==='share-post' && document.getElementById('share-search')?.value.trim().toLowerCase()===term){result.forEach(p=>S.people.set(p.id,p));const candidates=[...S.people.values()].filter(p=>p.id!==uid()&&!S.blocked.has(p.id)&&p.username?.toLowerCase().includes(term)).slice(0,35);const box=document.getElementById('share-targets');if(box){box.innerHTML=shareTargetMarkup(candidates,S.modal.postId);icons();hydrateMedia(box);}}
      }catch(err){console.warn(err);}},280);}
    }return;
  }

  if(e.target.id==='searchbox'){
    const q=e.target.value;S.searchText=q;clearTimeout(searchTimer);const t=++searchId;
    searchTimer=setTimeout(async()=>{
      try{await doSearch(q);if(t===searchId&&S.view==='search'){const host=document.getElementById('search-results');if(host){host.innerHTML=searchResultsMarkup();icons();hydrateMedia(host);}}}
      catch(err){onError(err);}
    },350);
  }
  if(e.target.id==='dm-search'){
    const q=e.target.value.toLowerCase().trim();
    const people=[...S.people.values()].filter(p=>p.id!==uid()&&(p.username?.includes(q)||p.display_name?.toLowerCase().includes(q))).slice(0,25);
    const el=document.getElementById('dm-results');if(el){el.innerHTML=people.map(p=>`<button data-action="dm-user" data-id="${p.id}" class="result-user">${avatar(p)}<span><strong>${h(p.username)}</strong><small>${h(name(p))}</small></span>${I('send',17)}</button>`).join('')||'<p class="muted">No matching people</p>';icons();}
  }
  if(e.target.id==='chat-filter'){
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('.thread-item').forEach(el=>el.hidden=!(el.dataset.username||'').toLowerCase().includes(q));
  }
});
document.addEventListener('change', async e=>{
  if(e.target.matches('select[data-setting]')){try{await updatePrivacy(e.target.dataset.setting,e.target.value);}catch(err){onError(err);refreshModal();}return;}
  if(e.target.id==='upload-file'){
    let files=[...e.target.files];
    try{
      if(!files.length)return;
      if(S.uploadType!=='post')files=files.slice(0,1);
      if(files.length>10)throw Error('Maximum 10 files per post');
      files.forEach(f=>validateFile(f));
      if(S.uploadType==='reel'&&!files[0].type.startsWith('video/'))throw Error('Please select a video for reels');
      const dialog=document.querySelector('.create-dialog');
      if(dialog){S.modal.caption=dialog.querySelector('[name=caption]')?.value||'';S.modal.location=dialog.querySelector('[name=location]')?.value||'';}
      S.previewFiles.forEach(x=>URL.revokeObjectURL(x.url));S.previewFiles=files.map(file=>({file,url:URL.createObjectURL(file)}));refreshModal();
    }catch(err){onError(err);e.target.value='';}
  }
  if(e.target.id==='avatar-file'){
    const f=e.target.files?.[0];if(!f)return;
    try {validateFile(f,'avatar');const s=document.getElementById('avatar-filename');if(s)s.textContent=f.name;}catch(err){e.target.value='';onError(err);}
  }
  if(e.target.id==='chat-attachment'){
    const f=e.target.files?.[0];if(!f)return;
    try{validateFile(f);const el=document.getElementById('chat-file-label');if(el)el.textContent=`Attached: ${f.name}`;}catch(err){e.target.value='';onError(err);}
  }
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.modal)closeModal();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&S.user){e.preventDefault();navigate('search').then(()=>document.getElementById('searchbox')?.focus());}
  if(e.key==='ArrowRight'&&S.modal?.type==='story')storyMove(1);
  if(e.key==='ArrowLeft'&&S.modal?.type==='story')storyMove(-1);
});

// Android's hardware Back button dispatches popstate for same-document history entries.
window.addEventListener('popstate',()=>{
  if(!S.user)return;
  // A secondary screen always returns to Home; do not reload the whole installed app.
  if(S.view!=='home'||S.modal){
    S.viewUser=null; S.activeChat=null;
    void loadScreen('home',{fromHistory:true});
  }
});

// ────────── App initialization ──────────
async function initialize() {
  paint();
  if(!ready||!db)return;
  db.auth.onAuthStateChange((event,session)=>{
    // Do not await Supabase queries from inside the auth callback (avoids auth lock deadlocks).
    setTimeout(()=>{
      if(event==='PASSWORD_RECOVERY'){if(session?.user){bootstrapUser(session.user).then(()=>showModal('password')).catch(onError);}return;}
      if(event==='SIGNED_OUT'){S.user=null;S.me=null;render();return;}
      if(session?.user&&(!S.user||S.user.id!==session.user.id))bootstrapUser(session.user).catch(onError);
    },0);
  });
  try {
    const {data,error}=await db.auth.getSession();if(error)throw error;
    if(data.session?.user)await bootstrapUser(data.session.user);else renderAuth();
  } catch(e){onError(e);renderAuth();}
}
initialize();
