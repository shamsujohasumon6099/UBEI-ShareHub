import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/hind-siliguri/bengali-400.css';
import '@fontsource/hind-siliguri/bengali-500.css';
import '@fontsource/hind-siliguri/bengali-600.css';
import '@fontsource/hind-siliguri/bengali-700.css';
import '../styles/app.css';
import '../styles/accessibility.css';
import {BN} from '../i18n/messages.js';
import {seedDB} from '../demo/seed.js';
import {setPassword,checkPassword} from '../demo/passwords.js';
import {pad,ymd,parseYmd,addDays,todayYmd,calendarNow,postAt,isLive,isUrl,isFbUrl,cleanLink,sameLink,looksLikePost,csvCell,emptyDB} from '../lib/domain.js';
import {MODE} from '../lib/config.js';
import {Cloud} from '../services/cloud.js';
const ROLE = document.body.dataset.role;
let PAGES = {}, NAV = [], DEFAULT_PAGE = '', CTA, BOTTOM = [], CHIP, openPost, notifItems, onChange;
function configureHooks(hooks) { ({PAGES,NAV,DEFAULT_PAGE,CTA,BOTTOM,CHIP,openPost,notifItems,onChange} = hooks); }
/* Bangla translations. Keys are the English UI text; {placeholders} must stay the same. */

/* =====================================================
   UBEI ShareHub . shared core (admin + moderator)
   Live data is in Supabase; localStorage is used only by isolated demo mode.
   All UI text goes through T() so it can be shown in English or Bangla.
   ===================================================== */
const APP_VERSION = 'v3.0';
const DB_KEY = 'ubei_sharehub_demo_v3', THEME_KEY = 'ubei_sharehub_theme', LANG_KEY = 'ubei_sharehub_lang', SESSION_KEY = 'ubei_sharehub_session_' + ROLE;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- language ---------------- */
const EN_DATES = { MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'], MON: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOW: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };
const BN_DATES = { MONTHS: ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'], MON: ['জানু','ফেব্রু','মার্চ','এপ্রি','মে','জুন','জুলা','আগ','সেপ্টে','অক্টো','নভে','ডিসে'], DOW: ['রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র','শনি'] };
const MONTHS = [...EN_DATES.MONTHS], MON = [...EN_DATES.MON], DOW = [...EN_DATES.DOW];
let LANG = 'en';
try { LANG = localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en'; } catch (e) {}
function applyLang() {
  const src = LANG === 'bn' ? BN_DATES : EN_DATES;
  MONTHS.splice(0, 12, ...src.MONTHS); MON.splice(0, 12, ...src.MON); DOW.splice(0, 7, ...src.DOW);
  document.documentElement.lang = LANG === 'bn' ? 'bn' : 'en';
}
function setLang(l) { LANG = l === 'bn' ? 'bn' : 'en'; try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {} applyLang(); render(); }
/* T('English text {n}', { n: 3 }) -> translated text with values filled in. Values are inserted as-is, so escape user text before passing it. */
function T(s, v) {
  let out = (LANG === 'bn' && typeof BN === 'object' && BN[s]) || s;
  if (v) out = out.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
  return out;
}
applyLang();

const firstOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthLabel = d => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDate = s => { const d = parseYmd(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDay = s => { const d = parseYmd(s); return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
const fmtDT = iso => iso ? new Intl.DateTimeFormat(LANG === 'bn' ? 'bn-BD' : 'en-GB', {timeZone:'Asia/Dhaka',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(iso)) : '';
const timeAgo = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return T('just now'); if (s < 3600) return T('{n}m ago', { n: Math.floor(s / 60) }); if (s < 86400) return T('{n}h ago', { n: Math.floor(s / 3600) }); if (s < 86400 * 7) return T('{n}d ago', { n: Math.floor(s / 86400) }); return fmtDT(iso); };
/* picks the singular English text when n is 1 (Bangla has one form for both) */
const Tn = (n, one, many, v = {}) => T(n === 1 ? one : many, { n, ...v });
const dayLabel = d => { const t = todayYmd(); return d === t ? T('Today') : d === addDays(t, 1) ? T('Tomorrow') : d === addDays(t, -1) ? T('Yesterday') : fmtDay(d); };
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const uid = prefix => prefix + '_' + crypto.randomUUID();
const isAdminRole = r => r === 'admin' || r === 'superadmin';
const roleFits = u => ROLE === 'admin' ? isAdminRole(u.role) : u.role === 'moderator';
const isSuper = () => !!(App.user && App.user.role === 'superadmin');
const roleLabel = u => T({ superadmin: 'Super Admin', admin: 'Admin', moderator: 'Moderator' }[u.role] || u.role);
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const shortUrl = u => { const s = String(u || '').replace(/^https?:\/\/(www\.|m\.)?/, ''); return s.length > 40 ? s.slice(0, 38) + '...' : s; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const firstName = u => u ? String(u.name).split(' ')[0] : '';
const TAGS = { Promo: '#6366F1', Update: '#0EA5E9', Event: '#F59E0B', Offer: '#EC4899', Other: '#10B981' };
const COLORS = ['#6366F1','#0EA5E9','#10B981','#F59E0B','#EC4899','#8B5CF6','#14B8A6','#EF4444','#84CC16','#F97316'];

/* Password helpers are imported solely for isolated demo accounts. */

const MIN_PW = MODE === 'cloud' ? 10 : 6;

/* ---------------- icons ---------------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M3 3v18h18M8 17v-6M13 17V7M18 17v-4"/>',
  fb: '<path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/><path d="M14.5 11.5v6M11.5 14.5h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
};
const icon = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const logo = () => `<span class="logo">${icon('share', 18)}</span>`;
const avatar = (u, size = 32) => u && u.photo ? `<img class="av av-img" src="${esc(u.photo)}" alt="" style="--c:${u.color || '#6366F1'};width:${size}px;height:${size}px">` : u ? `<span class="av" style="--c:${u.color || '#6366F1'};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(initials(u.name))}</span>` : '';
const ST = { verified: ['Verified', 'b-verified', 'checkCircle'], pending: ['Pending', 'b-pending', 'clock'], rejected: ['Rejected', 'b-rejected', 'xCircle'], none: ['Not shared', 'b-none', 'alert'] };
const stLabel = st => T((ST[st] || ST.none)[0]);
const statusBadge = st => { const [l, c, i] = ST[st] || ST.none; return `<span class="badge ${c}">${icon(i, 13)}${T(l)}</span>`; };
const emptyHTML = (ic, title, sub = '') => `<div class="empty"><div class="e-ic">${icon(ic, 22)}</div><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const kpi = (label, val, sub, ic, tone) => `<div class="card kpi t-${tone}"><div class="k-top">${label}<span class="k-ic">${icon(ic, 17)}</span></div><div class="k-val">${val}</div><div class="k-sub">${sub}</div></div>`;
const pbar = (a, b, ok) => `<div class="pbar"><div class="bar ${ok ? 'ok' : ''}" style="flex:1"><i style="width:${Math.min(100, pct(a, b))}%"></i></div><span>${pct(a, b)}%</span></div>`;
const postThumb = p => p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : `<span class="thumb" style="--t:${TAGS[p.tag] || TAGS.Other}">${esc(initials(p.title))}</span>`;
const postMedia = p => p.image ? `<img class="post-img" src="${esc(p.image)}" alt="${esc(p.title)}">` : `<div class="post-img ph" style="--t:${TAGS[p.tag] || TAGS.Other}"><span>${esc(initials(p.title))}</span></div>`;
const liveBadge = p => isLive(p) ? `<span class="badge b-live">${T('Live')}</span>` : `<span class="badge b-sched">${T('Scheduled')}</span>`;
const tagHTML = p => `<span class="tag" style="--t:${TAGS[p.tag] || TAGS.Other}">${T(p.tag || 'Other')}</span>`;

/* ---------------- demo seed ---------------- */

/* ---------------- store ---------------- */
/* makes sure old or imported data has every field the app needs, and drops unsafe links */
function normalizeDB(d) {
  d.settings ||= {}; d.groups = Array.isArray(d.groups) ? d.groups : []; d.log = Array.isArray(d.log) ? d.log : [];
  const safe = value => value && isUrl(value) ? value : '';
  d.posts.forEach(p => { p.fbLink = safe(p.fbLink); if (p.image && !/^data:image\/jpeg;base64,/.test(p.image)) p.image = safe(p.image); p.assign ||= 'all'; p.assignees ||= []; p.groupTasks ||= []; });
  d.shares = d.shares.filter(s => isFbUrl(s.link));
  d.groups.forEach(g => { g.url = safe(g.url); });
  d.users.forEach(u => { u.fb = safe(u.fb); if (u.photo && !/^data:image\/jpeg;base64,/.test(u.photo)) u.photo = safe(u.photo); if (!/^#[0-9a-f]{6}$/i.test(u.color||'')) u.color = '#6366F1'; });
  if (MODE === 'demo') {
    if (!d.users.some(u => u.role === 'superadmin')) { const a = d.users.find(u => u.role === 'admin'); if (a) a.role = 'superadmin'; }
    d.users.forEach(u => { if (typeof u.password === 'string') setPassword(u, u.password); });
    d.settings.demo = true;
  }
  if (d.settings.deadlineHours === undefined) d.settings.deadlineHours = 24;
  return d;
}
function loadDB() {
  if (MODE !== 'demo') return emptyDB();
  try { const d = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); if (d && Array.isArray(d.users) && Array.isArray(d.posts) && Array.isArray(d.shares)) return normalizeDB(d); } catch {}
  const d = normalizeDB(seedDB()); saveDB(d); return d;
}
/* rough % of the ~5 MB browser storage this data uses */
const storeUse = () => { try { return Math.min(100, Math.round((localStorage.getItem(DB_KEY) || '').length / 50000)); } catch (e) { return 0; } };
/* WhatsApp number in international form: 01XXXXXXXXX (Bangladesh) becomes 8801XXXXXXXXX */
function waNumber(ph) { let d = String(ph || '').replace(/\D/g, ''); if (/^01\d{9}$/.test(d)) d = '88' + d; else if (/^1\d{9}$/.test(d) && String(ph).trim().startsWith('+880')) d = '880' + d; return d.length >= 10 && d.length <= 15 ? d : ''; }
const modUrl = () => /^https?:$/.test(location.protocol) ? new URL('moderator.html', location.href).href : '';
function saveDB(d) {
  if (MODE !== 'demo') return false;
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); return true; }
  catch { toast(T('Storage is full. Use smaller images, or take a backup and remove old data.'), 'error'); return false; }
}
const State = { db: loadDB() };
const App = { user: null, page: '', month: firstOfMonth(calendarNow()), q: '', tab: 'pending', modFilter: '', whereFilter: '', sheetView: 'shares', sel: new Set(), dsel: new Set(), detailId: null, dWhere: '', dStatus: '', dayView: '', logType: '', modalPost: null, _confirm: null, review: null };

/* activity log: text is an English template with {vars}, so it can be shown in either language */
function logEvent(type, text, vars = {}) {
  if (!App.user || MODE === 'cloud') return;
  State.db.log = State.db.log || [];
  State.db.log.unshift({ id: uid('l'), at: new Date().toISOString(), by: App.user.id, type, text, vars });
  if (State.db.log.length > 600) State.db.log.length = 600;
}
function commit(msg, type, act) {
  if (MODE !== 'cloud') {
    if (!saveDB(State.db)) return false;
    const reopen = App.modalPost && $('#modal').classList.contains('open') ? App.modalPost : null;
    render(); if (reopen) openPost(reopen); if (msg) toast(msg, type, act); return true;
  }
  if (State.saving) return State.pendingWrite;
  State.saving = true; document.body.classList.add('is-saving');
  const draft = structuredClone(State.db), reopen = App.modalPost;
  updateSync('saving');
  State.pendingWrite = (async () => {
    try {
      State.db = normalizeDB(await Cloud.save(draft));
      App.user = userById(App.user?.id) || null;
      State.syncedAt = new Date(); State.sync = 'saved';
      render(); if (reopen && postById(reopen)) openPost(reopen); if (msg) toast(msg, type, act);
      return true;
    } catch (error) {
      State.db = normalizeDB(Cloud.baseline());
      try { State.db = normalizeDB(await Cloud.load()); } catch { /* keep last acknowledged snapshot */ }
      App.user = userById(App.user?.id) || null;
      State.sync = 'error'; render();
      toast(errorText(error), 'error'); return false;
    } finally { State.saving = false; document.body.classList.remove('is-saving'); updateSync(State.sync); }
  })();
  return State.pendingWrite;
}
/* notes the admin picks from the list are saved in English and shown in each person's language */
const noteText = n => n ? T(n) : '';
window.addEventListener('storage', e => {
  if (MODE !== 'demo') return;
  if (e.key === LANG_KEY) { try { LANG = localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en'; } catch (x) {} applyLang(); render(); return; }
  if (e.key !== DB_KEY) return;
  State.db = loadDB();
  if (App.user) {
    const u = State.db.users.find(x => x.id === App.user.id);
    if (!u || !u.active || !roleFits(u)) { logout(); return; }
    App.user = u;
  }
  render();
});

/* ---------------- queries ---------------- */
const userById = id => State.db.users.find(u => u.id === id);
const postById = id => State.db.posts.find(p => p.id === id);
const activeMods = () => State.db.users.filter(u => u.role === 'moderator' && u.active).sort((a, b) => a.name.localeCompare(b.name));

const canShare = p => isLive(p) && !!p.fbLink;
const byDateTime = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
const monthPosts = (md = App.month) => { const k = monthKey(md); return State.db.posts.filter(p => p.date.startsWith(k)).sort(byDateTime); };
const sharesOfPost = pid => State.db.shares.filter(s => s.postId === pid);
const groupById = id => State.db.groups.find(g => g.id === id);
const shareFor = (pid, userId, gid) => State.db.shares.find(s => s.postId === pid && s.userId === userId && (s.groupId || null) === (gid || null));
const taskKey = (u, g) => u + '|' + (g || '');
const targetName = gid => gid ? ((groupById(gid) || {}).name || T('Deleted group')) : T('Profile');
/* who must share this post on their own profile */
function profileAssignees(p) {
  if (p.assign === 'none') return [];
  if (p.assign === 'selected') return (p.assignees || []).filter(id => { const u = userById(id); return u && u.role === 'moderator' && u.active; });
  return activeMods().map(u => u.id);
}
/* every expected share task for a post: profile tasks + group tasks */
function tasksFor(p) {
  const t = profileAssignees(p).map(u => ({ userId: u, groupId: null }));
  if (p.groupShare) (p.groupTasks || []).forEach(g => { const u = userById(g.userId); if (u && u.role === 'moderator' && u.active && groupById(g.groupId)) t.push({ userId: g.userId, groupId: g.groupId }); });
  return t;
}
/* tasks with their share, plus shares that are no longer assigned */
function taskRows(p) {
  const t = tasksFor(p), keys = new Set(t.map(x => taskKey(x.userId, x.groupId)));
  const rows = t.map(x => ({ ...x, share: shareFor(p.id, x.userId, x.groupId), assigned: true }));
  sharesOfPost(p.id).forEach(s => { if (!keys.has(taskKey(s.userId, s.groupId))) rows.push({ userId: s.userId, groupId: s.groupId || null, share: s, assigned: false }); });
  return rows;
}
const tasksOfUser = (p, id) => taskRows(p).filter(r => r.userId === id);
const targetBadge = gid => gid ? `<span class="where grp" title="${esc(targetName(gid))}">${icon('users', 12)}<span>${esc(targetName(gid))}</span></span>` : `<span class="where">${icon('user', 12)}<span>${T('Profile')}</span></span>`;
function monthShares(md = App.month) { const ids = new Set(monthPosts(md).map(p => p.id)); return State.db.shares.filter(s => ids.has(s.postId)); }
/* share deadline: the post time + N hours (Settings). 0 = no deadline */
const deadlineH = () => +(State.db.settings.deadlineHours || 0);
function dueAt(p) { const h = deadlineH(); return h && p ? new Date(postAt(p).getTime() + h * 3600000) : null; }
/* late = the first link came in after the deadline (a fix after a rejection does not make it late) */
const isLate = s => { const p = s && postById(s.postId), d = dueAt(p); return !!(d && new Date(s.firstAt || s.submittedAt) > d); };
const lateBadge = s => isLate(s) ? ` <span class="badge b-late" title="${T('Submitted after the deadline')}">${T('Late')}</span>` : '';
function dueBadge(p) {
  const d = dueAt(p); if (!d || !canShare(p)) return '';
  const left = d - Date.now();
  if (left < 0) return `<span class="badge b-rejected">${icon('clock', 12)}${T('Overdue')}</span>`;
  const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000);
  return `<span class="badge ${left < 3 * 3600000 ? 'b-pending' : 'b-none'}">${icon('clock', 12)}${h ? T('{h}h {m}m left', { h, m }) : T('{m}m left', { m })}</span>`;
}
function statsFor(userId, md = App.month) {
  const c = { total: 0, verified: 0, pending: 0, rejected: 0, profile: 0, group: 0, expected: 0, late: 0, onTime: 0 };
  monthShares(md).forEach(s => { if (s.userId === userId) { c.total++; c[s.status]++; s.groupId ? c.group++ : c.profile++; if (isLate(s)) c.late++; else if (s.status === 'verified') c.onTime++; } });
  monthPosts(md).filter(canShare).forEach(p => { c.expected += tasksFor(p).filter(t => t.userId === userId).length; });
  return c;
}
function sheetPeople(md = App.month) {
  const ids = new Set(monthShares(md).map(s => s.userId));
  return State.db.users.filter(u => u.role === 'moderator' && (u.active || ids.has(u.id))).sort((a, b) => a.name.localeCompare(b.name));
}
function leaderboard(md = App.month) {
  return sheetPeople(md).map(u => ({ u, ...statsFor(u.id, md) }))
    .sort((a, b) => b.verified - a.verified || b.total - a.total || a.u.name.localeCompare(b.u.name));
}
const shareablePosts = (md = App.month) => monthPosts(md).filter(canShare);
const activeNotice = () => { const n = State.db.settings.notice; return n && n.text && (!n.until || n.until >= todayYmd()) ? n : null; };

/* ---------------- ui helpers ---------------- */
/* toast(msg, type, { label, fn }) shows an optional button, e.g. Undo */
function toast(msg, type = 'success', act) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast ' + type; t.setAttribute('role', 'status');
  t.innerHTML = icon(type === 'error' ? 'alert' : 'checkCircle', 18) + '<span>' + esc(msg) + '</span>' + (act ? `<button class="toast-act">${icon('undo', 14)} ${esc(act.label)}</button>` : '');
  if (act) t.querySelector('.toast-act').addEventListener('click', () => { t.remove(); runEvent(act.fn); });
  box.appendChild(t); setTimeout(() => t.remove(), act ? 7000 : 3400);
}
function openModal({ title, sub = '', body, foot = '', size = '' }) {
  App.modalPost = null;
  State.focusOrigin = document.activeElement; $('#app').inert = true; document.body.classList.add('modal-open');
  const m = $('#modal');
  m.innerHTML = `<div class="modal-back" data-action="close-modal"></div><div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="icon-btn sm" data-action="close-modal" aria-label="${T('Close')}">${icon('x', 16)}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  m.classList.add('open');
  setTimeout(() => { const f = m.querySelector('.modal-body input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]),.modal-body textarea'); f && f.focus(); }, 40);
}
function closeModal() {
  const m = $('#modal'); m.classList.remove('open'); m.innerHTML = ''; App.modalPost = null; App.review = null;
  $('#app').inert = false; document.body.classList.remove('modal-open');
  if (State.focusOrigin?.isConnected) State.focusOrigin.focus(); State.focusOrigin = null;
}
function confirmBox(title, msg, onYes, label, danger = true) {
  openModal({ title, size: 'sm', body: `<p class="muted" style="margin:0">${msg}</p>`,
    foot: `<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirm-yes">${label || T('Yes, continue')}</button>` });
  App._confirm = onYes;
}
function copyText(t, msg) {
  const done = () => toast(msg || T('Copied to clipboard'));
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done).catch(() => fallback());
  else fallback();
  function fallback() { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(T('Could not copy'), 'error'); } a.remove(); }
}
function download(name, text, type) {
  const blob = new Blob([text], { type }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function getTheme() { let t = null; try { t = localStorage.getItem(THEME_KEY); } catch (e) {} return t || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
setTheme(getTheme());
/* login lasts for this tab; with "Keep me logged in" it lasts 30 days on this device */
const KEEP_KEY = 'ubei_sharehub_keep_' + ROLE, LOCK_KEY = 'ubei_sharehub_lock_' + ROLE;
function getSession() {
  try { const s = sessionStorage.getItem(SESSION_KEY); if (s) return s; } catch (e) { if (App._sid) return App._sid; }
  try { const k = JSON.parse(localStorage.getItem(KEEP_KEY) || 'null'); if (k && k.exp > Date.now()) return k.id; } catch (e) {}
  return null;
}
function setSession(id, keep) {
  App._sid = id;
  try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  try { if (id && keep) localStorage.setItem(KEEP_KEY, JSON.stringify({ id, exp: Date.now() + 30 * 86400000 })); else if (!id) localStorage.removeItem(KEEP_KEY); } catch (e) {}
}
async function logout() {
  if (MODE === 'cloud') { try { await Cloud.logout(); } catch {} State.db = emptyDB(); }
  setSession(null); App.user = null; closeModal(); closePop(); document.body.classList.remove('nav-open'); render();
}
function getLock() { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
function setLock(l) { try { l ? localStorage.setItem(LOCK_KEY, JSON.stringify(l)) : localStorage.removeItem(LOCK_KEY); } catch (e) {} }

/* ---------------- notifications (bell) ---------------- */
/* each app defines notifItems() -> [{ at, ic, tone, html, act: 'data-action=... data-id=...' }] */
function unreadCount() { if (typeof notifItems !== 'function' || !App.user) return 0; const seen = App.user.notifSeen || ''; return notifItems().filter(i => i.at > seen).length; }
const bellBtn = () => { const n = unreadCount(); return `<button class="icon-btn bell" data-action="notif" title="${T('Notifications')}" aria-label="${T('Notifications')}">${icon('bell')}${n ? `<em class="bell-n">${n > 9 ? '9+' : n}</em>` : ''}</button>`; };
function closePop() { const p = $('#pop'); if (p) p.remove(); }
function openNotif() {
  if ($('#pop')) { closePop(); return; }
  const seen = App.user.notifSeen || '', items = notifItems().slice(0, 40);
  const list = items.length ? items.map(i => `<button class="nf-row ${i.at > seen ? 'unread' : ''}" ${i.act || ''}><span class="nf-ic t-${i.tone || 'accent'}">${icon(i.ic, 15)}</span><span class="nf-t">${i.html}<small>${timeAgo(i.at)}</small></span></button>`).join('') : emptyHTML('bell', T('No notifications yet'));
  const box = document.createElement('div'); box.id = 'pop'; box.className = 'pop';
  box.innerHTML = `<div class="pop-h"><b>${T('Notifications')}</b><span class="spacer"></span><button class="btn sm ghost" data-action="notif">${T('Close')}</button></div><div class="pop-b">${list}</div>`;
  document.body.appendChild(box);
  const u = userById(App.user.id); if (u) { u.notifSeen = new Date().toISOString(); App.user = u; MODE === 'cloud' ? commit() : saveDB(State.db); }
  const b = $('.bell .bell-n'); if (b) b.remove();
}
document.addEventListener('click', e => { const p = $('#pop'); if (p && !p.contains(e.target) && !e.target.closest('[data-action=notif]')) closePop(); else if (p && e.target.closest('.nf-row')) closePop(); }, true);
const langBtn = cls => `<button class="btn sm lang-btn ${cls || ''}" data-action="lang" title="${LANG === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}">${icon('globe', 15)}<span>${LANG === 'bn' ? 'English' : 'বাংলা'}</span></button>`;

/* ---------------- login ---------------- */
function renderLogin() {
  document.title = T(ROLE === 'admin' ? 'Admin Login' : 'Moderator Login') + ' | UBEI ShareHub';
  const sh = monthShares(firstOfMonth(calendarNow()));
  const ver = sh.filter(s => s.status === 'verified').length;
  /* demo accounts and numbers only show while the demo data is loaded, never on real data */
  const isDemo = !!State.db.settings.demo;
  const demo = !isDemo ? '' : ROLE === 'admin'
    ? `<div class="demo"><b>${T('Demo accounts')}</b> ${T('(click to fill)')}<div class="demo-list"><button type="button" data-action="fill-demo" data-u="admin" data-p="admin123">${T('Super Admin')}: admin / admin123</button><button type="button" data-action="fill-demo" data-u="manager" data-p="1234">${T('Admin')}: manager / 1234</button></div></div>`
    : `<div class="demo"><b>${T('Demo accounts')}</b> ${T('(click to fill)')}<div class="demo-list">${State.db.users.filter(u => u.role === 'moderator' && u.active && /^u_m\d$/.test(u.id)).slice(0, 4).map(u => `<button type="button" data-action="fill-demo" data-u="${esc(u.username)}" data-p="1234">${esc(u.username)} / 1234</button>`).join('')}</div></div>`;
  const feat = (ic, t) => `<div class="glass feat">${icon(ic, 18)}<span>${t}</span></div>`;
  $('#app').innerHTML = `<div class="login">
    <div class="login-art">
      <div class="brand">${logo()}<div>UBEI ShareHub<small>${T('Facebook share tracking')}</small></div></div>
      <div class="art-copy">
        <h1>${T(ROLE === 'admin' ? 'Every post. Every share. One control room.' : 'Share the post. Submit the link. Get counted.')}</h1>
        <p>${T(ROLE === 'admin' ? 'Plan posts on the calendar, assign who shares where, check every shared link and download a monthly sheet.' : 'See the posts on the calendar, share them on your profile or in groups, submit the links and track your rank.')}</p>
      </div>
      <div class="art-cards">${isDemo ? `
        <div class="glass"><b>${monthPosts(firstOfMonth(calendarNow())).length}</b><span>${T('Posts this month')}</span></div>
        <div class="glass"><b>${sh.length}</b><span>${T('Shares submitted')}</span></div>
        <div class="glass"><b>${pct(ver, sh.length)}%</b><span>${T('Verified rate')}</span></div>` : `${feat('calendar', T('Post calendar'))}${feat('checkCircle', T('Link checking'))}${feat('table', T('Monthly sheet'))}`}
      </div>
    </div>
    <div class="login-form-wrap">
      <div class="login-tools">${langBtn()}<button class="icon-btn" data-action="theme" aria-label="${T('Light / Dark')}">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button></div>
      <form class="login-form" data-form="login" autocomplete="on">
        <span class="role-pill">${icon(ROLE === 'admin' ? 'shield' : 'users', 14)} ${T(ROLE === 'admin' ? 'Admin Panel' : 'Moderator Panel')}</span>
        <h2>${T('Welcome back')}</h2>
        <p class="muted">${T('Log in with your account.')}</p>
        <label class="field"><span>${T(MODE === 'cloud' ? 'Email' : 'Username or email')}</span><input name="username" type="${MODE === 'cloud' ? 'email' : 'text'}" autocomplete="username" required></label>
        <label class="field"><span>${T('Password')}</span><input type="password" name="password" autocomplete="current-password" required></label>
        <label class="check-line"><input type="checkbox" name="keep" checked> ${T('Keep me logged in on this device')}</label>
        <div class="form-err" id="loginErr" role="alert"></div>
        <button class="btn primary block lg" type="submit">${T('Log in')} ${icon('chevR', 16)}</button>
        ${demo}
        <a class="switch-link" href="${ROLE === 'admin' ? 'moderator.html' : 'admin.html'}">${T(ROLE === 'admin' ? 'Moderator? Log in here' : 'Admin login')} ${String.fromCharCode(8594)}</a>
      </form>
    </div></div>`;
}

/* ---------------- shell ---------------- */
function renderShell() {
  const P = PAGES[App.page];
  const title = typeof P.title === 'function' ? P.title() : T(P.title);
  document.title = title + ' | UBEI ShareHub';
  const nav = NAV.map(n => {
    if (n.show && !n.show()) return '';
    if (n.section) return `<div class="nav-label">${T(n.section)}</div>`;
    const b = n.badge ? n.badge() : '';
    return `<button class="nav-item ${App.page === n.id ? 'active' : ''}" data-action="nav" data-page="${n.id}">${icon(n.icon)}<span>${T(n.label)}</span>${b ? `<em class="nav-badge">${b}</em>` : ''}</button>`;
  }).join('');
  $('#app').innerHTML = `<div class="shell">
    <aside class="sidebar">
      <div class="brand">${logo()}<div>UBEI ShareHub<small>${T(ROLE === 'admin' ? 'Admin Console' : 'Moderator Space')}</small></div></div>
      <nav>${nav}</nav>
      <div class="side-foot">${avatar(App.user, 36)}<div class="who"><b>${esc(App.user.name)}</b><span>${ROLE === 'admin' ? roleLabel(App.user) : '@' + esc(App.user.username)}</span></div><button class="icon-btn sm" data-action="logout" title="${T('Log out')}" aria-label="${T('Log out')}">${icon('logout', 16)}</button></div>
    </aside>
    <div class="scrim" data-action="menu"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-action="menu" aria-label="${T('Open menu')}">${icon('menu')}</button>
        <div class="page-title"><h1>${title}</h1><p>${P.sub ? P.sub() : ''}</p></div>
        <div class="top-actions">${syncHTML()}
          ${P.search ? `<label class="search">${icon('search', 16)}<input id="q" type="search" placeholder="${T(P.search)}" value="${esc(App.q)}" aria-label="${T('Search')}"></label>` : ''}
          ${P.month === false ? '' : `<div class="month-sw"><button data-action="month" data-d="-1" aria-label="${T('Previous month')}">${icon('chevL', 16)}</button><span>${monthLabel(App.month)}</span><button data-action="month" data-d="1" aria-label="${T('Next month')}">${icon('chevR', 16)}</button></div>${monthKey(App.month) !== monthKey(calendarNow()) ? `<button class="btn sm" data-action="month" data-d="0">${T('This month')}</button>` : ''}`}
          ${langBtn()}
          ${typeof notifItems === 'function' ? bellBtn() : ''}
          <button class="icon-btn" data-action="theme" title="${T('Light / Dark')}" aria-label="${T('Light / Dark')}">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
          ${typeof CTA === 'function' ? CTA() : ''}
        </div>
      </header>
      <main class="content" id="content"></main>
    </div>
    ${typeof BOTTOM !== 'undefined' && BOTTOM ? `<nav class="bottom-nav" aria-label="${T('Quick menu')}">${BOTTOM.map(b => { const n = NAV.find(x => x.id === b.id) || {}, bd = n.badge ? n.badge() : ''; return `<button class="${App.page === b.id ? 'active' : ''}" data-action="nav" data-page="${b.id}">${icon(b.icon || n.icon, 20)}<span>${T(b.label || n.label)}</span>${bd ? `<em>${bd}</em>` : ''}</button>`; }).join('')}</nav>` : ''}
  </div>`;
}
function renderPage() { $('#content').innerHTML = PAGES[App.page].render(); }
function render() {
  if (MODE === 'setup') { renderSetup(); return; }
  if (!App.user) { renderLogin(); return; }
  if (!PAGES[App.page] || (App.page === 'member' && !userById(App.detailId))) App.page = DEFAULT_PAGE;
  renderShell(); renderPage();
}

/* ---------------- calendar ---------------- */
function calendarHTML() {
  const md = App.month, y = md.getFullYear(), m = md.getMonth(), dim = new Date(y, m + 1, 0).getDate(), start = new Date(y, m, 1).getDay(), t = todayYmd();
  const by = {}; monthPosts().forEach(p => (by[p.date] = by[p.date] || []).push(p));
  const addable = ROLE === 'admin';
  let cells = '';
  for (let i = 0; i < start; i++) cells += '<div class="cal-cell out"></div>';
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`, list = by[ds] || [];
    cells += `<div class="cal-cell${ds === t ? ' today' : ''}${ds < t ? ' past' : ''}"${addable ? ` data-action="new-post" data-date="${ds}"` : ''}><div class="cal-date"><span>${d}</span>${addable ? `<i class="cal-add" aria-hidden="true">${icon('plus', 14)}</i>` : ''}</div><div class="cal-chips">${list.map(CHIP).join('')}</div></div>`;
  }
  const tail = (7 - (start + dim) % 7) % 7;
  for (let i = 0; i < tail; i++) cells += '<div class="cal-cell out"></div>';
  const days = Object.keys(by).sort();
  const agenda = days.length ? days.map(ds => { const d = parseYmd(ds); return `<div class="ag-day${ds === t ? ' today' : ''}"><div class="date-box"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div><div class="ag-list">${by[ds].map(CHIP).join('')}</div></div>`; }).join('') : emptyHTML('calendar', T('No posts this month'));
  return `<div class="cal"><div class="cal-head">${DOW.map(x => `<div>${x}</div>`).join('')}</div><div class="cal-grid">${cells}</div></div><div class="agenda card">${agenda}</div>`;
}

/* ---------------- leaderboard ---------------- */
function lbRows(limit) {
  const lb = leaderboard();
  if (!lb.length) return emptyHTML('users', T('No moderators yet'));
  return lb.slice(0, limit || lb.length).map((r, i) => `<div class="lb-row ${r.u.id === App.user.id ? 'mine' : ''} ${ROLE === 'admin' ? 'clickable' : ''}" ${ROLE === 'admin' ? `data-action="view-mod" data-id="${r.u.id}"` : ''}><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span>${avatar(r.u, 34)}<div class="grow"><b>${esc(r.u.name)}${r.u.id === App.user.id ? ' ' + T('(you)') : ''}</b>${pbar(r.verified, r.expected, true)}</div><div class="score"><b>${r.verified}</b><small>${T('verified of {n} tasks', { n: r.expected })}</small></div></div>`).join('');
}
function leaderboardPage() {
  const lb = leaderboard();
  if (!lb.length) return `<div class="card">${emptyHTML('trophy', T('No data for this month'))}</div>`;
  const top = lb.slice(0, 3), order = [top[1], top[0], top[2]].filter(Boolean);
  const pod = order.map(r => { const rank = lb.indexOf(r) + 1; return `<div class="card pod ${rank === 1 ? 'p1' : ''} ${ROLE === 'admin' ? 'clickable' : ''}" ${ROLE === 'admin' ? `data-action="view-mod" data-id="${r.u.id}"` : ''}><span class="rank r${rank} medal">${rank}</span>${avatar(r.u, rank === 1 ? 64 : 52)}<b>${esc(r.u.name)}</b><div class="big">${r.verified}</div><small class="muted">${T('verified shares')}</small></div>`; }).join('');
  const rows = lb.map((r, i) => `<tr class="${r.u.id === App.user.id ? 'mine' : ''}"><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td><td><div class="person ${ROLE === 'admin' ? 'clickable' : ''}" ${ROLE === 'admin' ? `data-action="view-mod" data-id="${r.u.id}"` : ''}>${avatar(r.u, 32)}<div><b>${esc(r.u.name)}</b><small>@${esc(r.u.username)}${r.u.active ? '' : ' . ' + T('inactive')}</small></div></div></td><td class="num">${r.expected}</td><td class="num">${r.profile}</td><td class="num">${r.group}</td><td class="num"><b>${r.verified}</b></td>${deadlineH() ? `<td class="num">${r.late ? `<span class="late-n">${r.late}</span>` : '0'}</td>` : ''}<td class="num">${r.pending}</td><td class="num">${r.rejected}</td><td style="min-width:150px">${pbar(r.verified, r.expected, true)}</td></tr>`).join('');
  return `<div class="podium">${pod}</div>
  <div class="card"><div class="card-h"><div><h3>${T('Full ranking')}</h3><p>${T('Ranked by verified shares. Completion = verified / assigned tasks (profile + group).')}</p></div></div>
  <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>${T('Moderator')}</th><th class="num">${T('Tasks')}</th><th class="num">${T('Profile sent')}</th><th class="num">${T('Group sent')}</th><th class="num">${T('Verified')}</th>${deadlineH() ? `<th class="num" title="${T('Submitted after the deadline')}">${T('Late')}</th>` : ''}<th class="num">${T('Pending')}</th><th class="num">${T('Rejected')}</th><th>${T('Completion')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* ---------------- monthly sheet ---------------- */
function sheetData() {
  const posts = monthPosts();
  const ids = new Set(); posts.forEach(p => taskRows(p).forEach(r => ids.add(r.userId)));
  const people = State.db.users.filter(u => u.role === 'moderator' && (u.active || ids.has(u.id))).sort((a, b) => a.name.localeCompare(b.name));
  return { posts, people };
}
const shortTarget = gid => { if (!gid) return T('Profile'); const n = targetName(gid); return n.length > 14 ? n.slice(0, 13) + '.' : n; };
function assignSummary(p) {
  if (p.assign === 'none') return `<span class="muted small">${T('Nobody')}</span>`;
  if (p.assign === 'selected') return `<span class="small">${T('{n} selected', { n: `<b>${profileAssignees(p).length}</b>` })}</span>`;
  return `<span class="small">${T('All moderators')}</span>`;
}
function sheetPage() {
  const { posts, people } = sheetData(), me = App.user.id, isAdmin = ROLE === 'admin';
  const view = App.sheetView;
  const head = `<div class="toolbar no-print"><div class="tabs"><button class="tab ${view === 'shares' ? 'active' : ''}" data-action="set" data-key="sheetView" data-val="shares">${icon('table', 15)} ${T('Share sheet')}</button><button class="tab ${view === 'schedule' ? 'active' : ''}" data-action="set" data-key="sheetView" data-val="schedule">${icon('calendar', 15)} ${T('Posting schedule')}</button></div><span class="spacer"></span><button class="btn" data-action="export-csv">${icon('download', 16)} ${T('Export CSV')}</button><button class="btn" data-action="print">${icon('printer', 16)} ${T('Print / PDF')}</button></div>`;
  if (!posts.length) return head + `<div class="card">${emptyHTML('table', T('No posts this month'), isAdmin ? T('Add posts from the calendar.') : '')}</div>`;
  if (view === 'schedule') {
    const rows = posts.map((p, i) => { const tr = taskRows(p).filter(r => r.assigned), v = tr.filter(r => r.share && r.share.status === 'verified').length, g = tr.filter(r => r.groupId); return `<tr><td class="num">${i + 1}</td><td><b>${fmtDate(p.date)}</b><br><small class="muted">${DOW[parseYmd(p.date).getDay()]}${p.time ? ', ' + fmtTime(p.time) : ''}</small></td><td><div class="cell-post" data-action="open-post" data-id="${p.id}" style="cursor:pointer">${postThumb(p)}<div><b>${esc(p.title)}</b><small>${tagHTML(p)}</small></div></div></td><td>${liveBadge(p)}</td><td>${assignSummary(p)}</td><td><div class="wheres">${g.length ? [...new Set(g.map(r => r.groupId))].map(targetBadge).join('') : `<span class="muted small">${T('No group')}</span>`}</div></td><td class="num">${v} / ${tr.length}</td></tr>`; }).join('');
    return head + `<div class="card"><div class="card-h"><div><h3>${T('Posting schedule, {m}', { m: monthLabel(App.month) })}</h3><p>${T('{n} posts, {l} live, {s} scheduled', { n: posts.length, l: posts.filter(isLive).length, s: posts.filter(p => !isLive(p)).length })}</p></div></div><div class="table-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>${T('Date')}</th><th>${T('Post')}</th><th>${T('Status')}</th><th>${T('Profile share')}</th><th>${T('Groups')}</th><th class="num">${T('Verified / Tasks')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  const colTot = {}; people.forEach(u => colTot[u.id] = { v: 0, t: 0, e: 0 });
  const rank = { rejected: 0, none: 0, pending: 1, verified: 2 };
  const body = posts.map(p => {
    let rv = 0, re = 0;
    const live = canShare(p), rows = taskRows(p);
    const cells = people.map(u => {
      const mine = u.id === me && !isAdmin, list = rows.filter(r => r.userId === u.id);
      let cls = 'cn', inner = `<span class="muted" title="${T('Not assigned')}">-</span>`;
      if (!live && list.length) { cls = 'cs'; inner = list.map(r => `<span class="mini">${esc(shortTarget(r.groupId))}</span>`).join(''); }
      else if (list.length) {
        let worst = 2;
        inner = list.map(r => {
          const st = r.share ? r.share.status : 'none'; worst = Math.min(worst, rank[st]);
          if (r.share) { colTot[u.id].t++; if (st === 'verified') { colTot[u.id].v++; if (r.assigned) rv++; } }
          if (r.assigned) { colTot[u.id].e++; re++; }
          return `<span class="mini m-${st}">${icon({ verified: 'check', pending: 'clock', rejected: 'x', none: 'alert' }[st], 11)}${esc(shortTarget(r.groupId))}</span>`;
        }).join('');
        cls = ['cr', 'cp', 'cv'][worst];
      }
      const act = (isAdmin || mine) && list.length ? `data-action="open-post" data-id="${p.id}"` : '';
      const tip = list.length ? list.map(r => `${targetName(r.groupId)}: ${r.share ? stLabel(r.share.status) : T('Not shared')}`).join(', ') : T('Not assigned');
      return `<td class="cell ${cls} ${mine ? 'mycol' : ''}" ${act} title="${esc(u.name + ': ' + tip)}"><div class="minis">${inner}</div></td>`;
    }).join('');
    return `<tr><th class="sticky" scope="row"><b>${esc(p.title)}</b><small>${fmtDay(p.date)}${p.time ? ', ' + fmtTime(p.time) : ''}</small></th>${cells}<td class="tot">${live ? `${rv}/${re}` : '-'}</td></tr>`;
  }).join('');
  const sum = k => Object.values(colTot).reduce((a, c) => a + c[k], 0);
  const foot = `<tr><th class="sticky">${T('Assigned tasks')}</th>${people.map(u => `<td>${colTot[u.id].e}</td>`).join('')}<td>${sum('e')}</td></tr>
    <tr><th class="sticky">${T('Submitted')}</th>${people.map(u => `<td>${colTot[u.id].t}</td>`).join('')}<td>${sum('t')}</td></tr>
    <tr><th class="sticky">${T('Verified')}</th>${people.map(u => `<td style="color:var(--success)">${colTot[u.id].v}</td>`).join('')}<td style="color:var(--success)">${sum('v')}</td></tr>
    <tr><th class="sticky">${T('Completion')}</th>${people.map(u => `<td>${pct(colTot[u.id].v, colTot[u.id].e)}%</td>`).join('')}<td>${pct(sum('v'), sum('e'))}%</td></tr>`;
  return head + `<div class="card"><div class="card-h"><div><h3>${T('Share sheet, {m}', { m: monthLabel(App.month) })}</h3><p>${T('Each cell shows that moderator\'s tasks: "Profile" means their own timeline, other names are groups.')} ${T(isAdmin ? 'Click a cell to open the post and verify.' : 'Click your own column to open the post.')}</p></div>
    <div class="legend"><span><i style="--d:#10B981"></i>${T('Verified')}</span><span><i style="--d:#F59E0B"></i>${T('Pending')}</span><span><i style="--d:#EF4444"></i>${T('Rejected / not shared')}</span><span><i style="--d:#94A3B8"></i>${T('Not assigned')}</span></div></div>
    <div class="sheet-wrap"><table class="sheet"><thead><tr><th class="sticky">${T('Post')}</th>${people.map(u => `<th><div class="th-person">${avatar(u, 26)}<span>${esc(firstName(u))}${u.id === me && !isAdmin ? ' ' + T('(you)') : ''}</span></div></th>`).join('')}<th>${T('Verified / Tasks')}</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div></div>`;
}
/* CSV stays in English so spreadsheets and formulas look the same for everyone */
function exportSheetCSV() {
  const { posts, people } = sheetData();
  /* a cell that starts with = + - @ could run as a formula in Excel, so it gets a ' in front */
  const q = csvCell;
  const where = gid => gid ? ((groupById(gid) || {}).name || 'Deleted group') : 'Profile';
  const stEn = st => (ST[st] || ST.none)[0];
  const dowEn = s => EN_DATES.DOW[parseYmd(s).getDay()];
  let rows;
  if (App.sheetView === 'schedule') {
    rows = [['#', 'Date', 'Day', 'Time', 'Title', 'Tag', 'Status', 'Page post link', 'Profile share by', 'Group tasks', 'Tasks', 'Verified']];
    posts.forEach((p, i) => {
      const tr = taskRows(p).filter(r => r.assigned);
      const prof = p.assign === 'none' ? 'Nobody' : profileAssignees(p).map(id => (userById(id) || {}).name).join(' / ');
      const grp = tr.filter(r => r.groupId).map(r => `${(userById(r.userId) || {}).name} > ${where(r.groupId)}`).join(' / ');
      rows.push([i + 1, p.date, dowEn(p.date), p.time || '', p.title, p.tag, isLive(p) ? 'Live' : 'Scheduled', p.fbLink || '', prof, grp || 'No group share', tr.length, tr.filter(r => r.share && r.share.status === 'verified').length]);
    });
  } else {
    rows = [['Date', 'Time', 'Post', ...people.map(u => u.name), 'Verified', 'Tasks']];
    const tot = people.map(() => ({ v: 0, t: 0, e: 0 }));
    posts.forEach(p => {
      let v = 0, e = 0; const tr = taskRows(p), live = canShare(p);
      const cells = people.map((u, i) => {
        const list = tr.filter(r => r.userId === u.id);
        if (!list.length) return 'Not assigned';
        if (!live) return 'Scheduled';
        return list.map(r => { if (r.assigned) { e++; tot[i].e++; } if (r.share) { tot[i].t++; if (r.share.status === 'verified') { tot[i].v++; if (r.assigned) v++; } } return `${where(r.groupId)}: ${r.share ? stEn(r.share.status) : 'Not shared'}`; }).join(' | ');
      });
      rows.push([p.date, p.time || '', p.title, ...cells, live ? v : '', live ? e : '']);
    });
    rows.push([], ['', '', 'Assigned tasks', ...tot.map(x => x.e)], ['', '', 'Submitted', ...tot.map(x => x.t)], ['', '', 'Verified', ...tot.map(x => x.v)]);
    rows.push([], ['Link details'], ['Date', 'Post', 'Moderator', 'Where', 'Status', 'Shared link', 'Submitted at', 'Late', 'Checked by', 'Admin note']);
    posts.forEach(p => sharesOfPost(p.id).forEach(s => { const u = userById(s.userId), c = userById(s.checkedBy); rows.push([p.date, p.title, u ? u.name : '?', where(s.groupId), stEn(s.status), s.link, new Date(s.submittedAt).toLocaleString('en-GB'), isLate(s) ? 'Yes' : '', c ? c.name : '', s.note || '']); }));
  }
  const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
  download(`ubei-sharehub-${App.sheetView === 'schedule' ? 'schedule' : 'share-sheet'}-${monthKey(App.month)}.csv`, csv, 'text/csv;charset=utf-8');
  toast(T('CSV is downloading'));
}

/* ---------------- post view pieces ---------------- */
function postInfo(p, extra = '') {
  return `<div class="post-meta">${liveBadge(p)}${tagHTML(p)}</div>
  <h2 class="post-title">${esc(p.title)}</h2>
  <div class="post-when">${icon('calendar', 15)} ${fmtDay(p.date)}${p.time ? ', ' + fmtTime(p.time) : ''}</div>
  ${p.caption ? `<div class="caption"><p>${esc(p.caption).replace(/\n/g, '<br>')}</p><button class="btn sm" data-action="copy" data-text="${esc(p.caption)}">${icon('copy', 14)} ${T('Copy caption')}</button></div>` : ''}
  <div class="post-btns">${p.fbLink ? `<a class="btn fb sm" href="${esc(p.fbLink)}" target="_blank" rel="noopener">${icon('fb', 15)} ${T('Open page post')}</a><button class="btn sm" data-action="copy" data-text="${esc(p.fbLink)}">${icon('link', 14)} ${T('Copy link')}</button>` : `<span class="muted small">${T('The page post link has not been added yet.')}</span>`}${extra}</div>`;
}
/* every task (profile + group) on a post, grouped by type */
function shareRows(p, mode) {
  const me = App.user.id, rows = taskRows(p);
  const nm = r => (userById(r.userId) || {}).name || '';
  const prof = rows.filter(r => !r.groupId).sort((a, b) => nm(a).localeCompare(nm(b)));
  const grp = rows.filter(r => r.groupId).sort((a, b) => targetName(a.groupId).localeCompare(targetName(b.groupId)) || nm(a).localeCompare(nm(b)));
  const row = r => {
    const u = userById(r.userId); if (!u) return '';
    const s = r.share, mine = u.id === me && mode === 'mod';
    let act = '';
    if (mode === 'admin' && s) act = `${s.status !== 'verified' ? `<button class="icon-btn sm ok" title="${T('Verify')}" aria-label="${T('Verify')}" data-action="verify" data-id="${s.id}" data-s="verified">${icon('check', 15)}</button>` : ''}${s.status !== 'rejected' ? `<button class="icon-btn sm bad" title="${T('Reject')}" aria-label="${T('Reject')}" data-action="verify" data-id="${s.id}" data-s="rejected">${icon('x', 15)}</button>` : ''}<button class="icon-btn sm" title="${T('Edit')}" aria-label="${T('Edit')}" data-action="edit-share" data-id="${s.id}" data-ret="${p.id}">${icon('edit', 15)}</button>`;
    else if (mode === 'mod' && s && !mine) act = `<span class="lock" title="${T('View only')}">${icon('lock', 14)}</span>`;
    const who = mode === 'admin' ? `<b class="clickable" data-action="view-mod" data-id="${u.id}">${esc(u.name)}</b>` : `<b>${esc(u.name)}${mine ? ` <em>${T('(you)')}</em>` : ''}</b>`;
    return `<div class="sl-row ${mine ? 'mine' : ''}">${avatar(u, 30)}<div class="sl-who">${who}<small>${r.assigned ? '' : T('No longer assigned') + ' . '}${s ? T('Submitted {t}', { t: timeAgo(s.submittedAt) }) : T('No link yet')}</small></div>${r.groupId ? targetBadge(r.groupId) : ''}${s ? `<a class="lnk" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('link', 14)}<span>${esc(shortUrl(s.link))}</span></a>` : ''}${statusBadge(s ? s.status : 'none')}${s ? lateBadge(s) : ''}<div class="sl-act">${act}</div></div>`;
  };
  const stat = list => { const v = list.filter(r => r.share && r.share.status === 'verified').length, sub = list.filter(r => r.share).length; return `<span class="muted small">${T('{s} submitted . {v} verified', { s: sub, v })}</span>`; };
  const profMode = p.assign === 'none' ? T('not needed') : p.assign === 'selected' ? T('selected people') : T('all moderators');
  return `<div class="sl-head">${icon('user', 15)} ${T('Profile share')} <span class="muted">(${profMode})</span><span class="spacer"></span>${prof.length ? stat(prof) : ''}</div>
    ${prof.length ? `<div class="share-list">${prof.map(row).join('')}</div>` : `<div class="note">${icon('alert', 16)}<span>${T('Nobody shares this post on their own profile.')}</span></div>`}
    <div class="sl-head">${icon('users', 15)} ${T('Group share')} <span class="muted">(${p.groupShare ? Tn(grp.length, '{n} task', '{n} tasks') : T('not needed')})</span><span class="spacer"></span>${grp.length ? stat(grp) : ''}</div>
    ${grp.length ? `<div class="share-list">${grp.map(row).join('')}</div>` : `<div class="note">${icon('alert', 16)}<span>${T('This post does not need to be shared in groups.')}</span></div>`}`;
}
function readImage(file, cb, max = 900, crop = false) {
  if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024) { toast(T('Please choose an image file'), 'error'); return; }
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height, sx = 0, sy = 0, sw = w, sh = h;
    if (crop) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = Math.min(max, m); }
    else if (Math.max(w, h) > max) { const scale = max / Math.max(w, h); w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale)); }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h); cb(c.toDataURL('image/jpeg', 0.78)); }; img.onerror = () => toast(T('Could not read the image'), 'error'); img.src = r.result; };
  r.onerror = () => toast(T('Could not read the image'), 'error'); r.readAsDataURL(file);
}

/* ---------------- my profile (admin + moderator) ---------------- */
function profilePage() {
  const u = App.user, all = State.db.shares.filter(s => s.userId === u.id), v = all.filter(s => s.status === 'verified').length;
  const isMod = u.role === 'moderator';
  return `<div class="grid cols-2e">
    <div class="card"><div class="card-h"><div><h3>${T('Profile')}</h3><p>${T(isMod ? 'Only an admin can change your name and username' : 'Your admin profile')}</p></div></div><div class="card-b">
      <div class="photo-row">${avatar(u, 84)}<div><b style="font-size:17px">${esc(u.name)}</b><small class="muted" style="display:block">@${esc(u.username)} . ${roleLabel(u)}</small>
        <div class="post-btns" style="margin-top:10px"><label class="btn sm" for="photoFile">${icon('upload', 14)} ${T(u.photo ? 'Change photo' : 'Upload photo')}</label>${u.photo ? `<button class="btn sm ghost danger-t" data-action="remove-photo">${T('Remove')}</button>` : ''}<input type="file" id="photoFile" accept="image/*" hidden></div></div></div>
      <form data-form="profile">
        ${isMod ? '' : `<label class="field"><span>${T('Name')}</span><input name="name" value="${esc(u.name)}" required></label>`}
        <label class="field"><span>${T('Email')}</span><input name="email" type="email" value="${esc(u.email || '')}" ${MODE === 'cloud' ? 'readonly' : ''} placeholder="you@example.com"><small>${T(MODE === 'cloud' ? 'Your login email. Contact a Super Admin to change it.' : 'In the online version, verification and password reset links go to this email.')}</small></label>
        ${isMod ? `<label class="field"><span>${T('WhatsApp number')}</span><input name="phone" type="tel" value="${esc(u.phone || '')}" placeholder="01XXXXXXXXX"><small>${T('The admin can send you reminders here')}</small></label>` : ''}
        <label class="field"><span>${T('Facebook profile link')}</span><input name="fb" type="url" value="${esc(u.fb || '')}" placeholder="https://www.facebook.com/..."></label>
        <button class="btn primary" type="submit">${T('Save profile')}</button></form>
      ${isMod ? `<dl class="kv" style="margin-top:18px"><dt>${T('All-time shares')}</dt><dd>${all.length}</dd><dt>${T('All-time verified')}</dt><dd style="color:var(--success)">${v}</dd><dt>${T('Verify rate')}</dt><dd>${pct(v, all.length)}%</dd></dl>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><div><h3>${T('Change password')}</h3></div></div><div class="card-b"><form data-form="password">
      <label class="field"><span>${T('Current password')}</span><input name="current" type="password" required autocomplete="current-password"></label>
      <label class="field"><span>${T('New password')}</span><input name="pw" type="password" required minlength="${MIN_PW}" autocomplete="new-password"><small>${T('At least {n} characters', { n: MIN_PW })}</small></label>
      <label class="field"><span>${T('Confirm new password')}</span><input name="pw2" type="password" required minlength="${MIN_PW}" autocomplete="new-password"></label>
      <button class="btn primary" type="submit">${T('Update password')}</button></form></div></div>
  </div>`;
}
function photoInput(targetId) {
  return `<div class="photo-row">${targetId && userById(targetId) ? avatar(userById(targetId), 56) : ''}<div><input type="hidden" name="photo" id="photoVal"><label class="btn sm" for="photoPick">${icon('upload', 14)} ${T('Choose photo')}</label> <span class="muted small" id="photoName">${T('Optional')}</span><input type="file" id="photoPick" accept="image/*" hidden></div></div>`;
}

/* ---------------- events ---------------- */
const Actions = {
  'close-modal': () => closeModal(),
  'confirm-yes': () => { const f = App._confirm; App._confirm = null; closeModal(); return f && f(); },
  nav: el => { const pg = el.dataset.page; App.q = ''; App.sel = new Set(); if (pg !== App.page) { try { history.pushState({ page: pg }, '', '#' + pg); } catch (e) {} } App.page = pg; document.body.classList.remove('nav-open'); closeModal(); render(); window.scrollTo(0, 0); },
  notif: () => openNotif(),
  month: el => { const d = +el.dataset.d; App.month = d === 0 ? firstOfMonth(calendarNow()) : new Date(App.month.getFullYear(), App.month.getMonth() + d, 1); App.sel = new Set(); render(); },
  theme: () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); render(); },
  lang: () => setLang(LANG === 'bn' ? 'en' : 'bn'),
  menu: () => document.body.classList.toggle('nav-open'),
  logout: () => logout(),
  copy: el => copyText(el.dataset.text),
  'fill-demo': el => { const f = $('form[data-form="login"]'); f.username.value = el.dataset.u; f.password.value = el.dataset.p; (el.dataset.p ? f.querySelector('button[type=submit]') : f.password).focus(); },
  'open-post': el => openPost(el.dataset.id),
  set: el => { App[el.dataset.key] = el.dataset.val; App.sel = new Set(); renderPage(); },
  'export-csv': () => exportSheetCSV(),
  'remove-photo': () => { const u = userById(App.user.id); delete u.photo; commit(T('Photo removed')); },
  print: () => window.print(),
};
const Forms = {
  profile: (f, fd) => {
    const u = userById(App.user.id), fb = String(fd.get('fb') || '').trim(), email = String(fd.get('email') || '').trim();
    if (fb && !isFbUrl(fb)) { toast(T('Enter a valid Facebook profile link'), 'error'); return; }
    if (email && !isEmail(email)) { toast(T('That email is not valid'), 'error'); return; }
    if (email && State.db.users.some(x => x.id !== u.id && (x.email || '').toLowerCase() === email.toLowerCase())) { toast(T('This email is used by another account'), 'error'); return; }
    const phone = String(fd.get('phone') || '').trim();
    if (phone && !waNumber(phone)) { toast(T('Enter a valid WhatsApp number'), 'error'); return; }
    if (fd.has('name')) { const n = String(fd.get('name')).trim(); if (n) u.name = n; }
    if (fd.has('phone')) u.phone = phone;
    u.fb = fb ? cleanLink(fb) : ''; u.email = email; App.user = u; commit(T('Profile saved'));
  },
  password: (f, fd) => {
    const u = userById(App.user.id);
    if (!checkPassword(u, String(fd.get('current') || ''))) { toast(T('Current password is wrong'), 'error'); return; }
    if (fd.get('pw') !== fd.get('pw2')) { toast(T('The new passwords do not match'), 'error'); return; }
    if (String(fd.get('pw')).length < MIN_PW) { toast(T('Password needs at least {n} characters', { n: MIN_PW }), 'error'); return; }
    setPassword(u, String(fd.get('pw'))); logEvent('user', '{by} changed their password'); commit(T('Password changed'));
  },
  login: (f, fd) => {
    const un = String(fd.get('username') || '').trim().toLowerCase(), pw = String(fd.get('password') || ''), err = $('#loginErr');
    const lock = getLock();
    if (lock.until > Date.now()) { err.textContent = T('Too many wrong tries. Please wait {s} seconds.', { s: Math.ceil((lock.until - Date.now()) / 1000) }); return; }
    const found = State.db.users.find(x => x.username.toLowerCase() === un || (x.email || '').toLowerCase() === un);
    const u = found && checkPassword(found, pw) ? found : null;
    if (!u) {
      lock.n = (lock.n || 0) + 1;
      if (lock.n >= 5) { setLock({ n: 0, until: Date.now() + 60000 }); err.textContent = T('Too many wrong tries. Please wait {s} seconds.', { s: 60 }); }
      else { setLock(lock); err.textContent = T('Wrong username or password.') + (lock.n >= 3 ? ' ' + T('{n} tries left.', { n: 5 - lock.n }) : ''); }
      return;
    }
    setLock(null);
    if (!roleFits(u)) { err.textContent = T(ROLE === 'admin' ? 'This is a moderator account. Please use the moderator panel.' : 'Admin accounts cannot log in here. Please use the admin panel.'); return; }
    if (!u.active) { err.textContent = T('This account is inactive. Please contact an admin.'); return; }
    setSession(u.id, !!fd.get('keep')); App.user = u; u.lastLogin = new Date().toISOString(); const h = location.hash.slice(1); App.page = PAGES[h] && h !== 'member' ? h : DEFAULT_PAGE;
    try { history.replaceState({ page: App.page }, '', '#' + App.page); } catch (e) {}
    logEvent('login', '{by} logged in'); saveDB(State.db); render();
    toast(T('Welcome, {name}!', { name: firstName(u) }));
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const fn = Actions[el.dataset.action]; if (fn) { if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault(); runEvent(() => fn(el, e)); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault(); const fn = Forms[f.dataset.form]; if (fn) runEvent(() => fn(f, new FormData(f)));
});
document.addEventListener('input', e => {
  const form = e.target.closest('form[data-form]'); if (form && form.dataset.form !== 'login') form.dataset.dirty = 'true';
  if (e.target.id === 'q') { App.q = e.target.value; renderPage(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (State.saving || State.actionBusy) return;
  if (t.dataset.filter) { App[t.dataset.filter] = t.value; App.sel = new Set(); renderPage(); return; }
  if (t.id === 'photoFile') { const photoUserId = App.user?.id; readImage(t.files[0], url => { if (!App.user || !userById(photoUserId) || App.user.id !== photoUserId) return; userById(photoUserId).photo = url; commit(T('Profile photo updated')); }, 256, true); return; }
  if (t.id === 'photoPick') { const f = t.files[0]; readImage(f, url => { if (!$('#photoVal')) return; $('#photoVal').value = url; $('#photoName').textContent = f.name; const row = t.closest('.photo-row'); const old = row.querySelector('.av'); const img = `<img class="av av-img" src="${url}" alt="" style="width:56px;height:56px">`; old ? old.outerHTML = img : row.insertAdjacentHTML('afterbegin', img); }, 256, true); return; }
  if (typeof onChange === 'function') runEvent(() => onChange(t, e));
});
/* browser / phone back button moves between pages instead of leaving the app */
window.addEventListener('popstate', e => {
  if (!App.user) return;
  const st = e.state || {}, h = st.page || location.hash.slice(1);
  closeModal(); closePop();
  if (h === 'member' && st.detail && userById(st.detail)) { App.detailId = st.detail; App.page = 'member'; }
  else App.page = PAGES[h] && h !== 'member' ? h : DEFAULT_PAGE;
  App.q = ''; App.sel = new Set(); render();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#pop')) { closePop(); return; }
  if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action]:not(button):not(a):not(input):not(select)')) { e.preventDefault(); e.target.click(); }
});

async function boot() {
  const banner = document.createElement('div'); banner.id = 'environment'; document.body.prepend(banner);
  document.body.dataset.mode = MODE;
  if (MODE === 'demo') banner.textContent = 'DEMO • Browser-only sample data • ডেমো: এটি প্রতিষ্ঠানের আসল ডেটা নয়';
  if (MODE === 'setup') { renderSetup(); return; }
  if (MODE === 'cloud') {
    $('#app').innerHTML = '<div class="loading-screen" role="status">UBEI ShareHub · '+T('Loading...')+'</div>';
    try {
      const user = await Cloud.restore();
      if (user) {
        State.db = normalizeDB(await Cloud.load());
        const member = userById(user.id);
        if (!member?.active || !roleFits(member)) {
          await Cloud.logout(); State.db = emptyDB(); render();
          toast(T('Use the login panel for your account role.'), 'error'); return;
        }
        App.user = member; State.syncedAt = new Date(); State.sync = 'saved';
      }
    } catch (error) { await Cloud.logout(); State.db = emptyDB(); render(); toast(errorText(error), 'error'); return; }
    Cloud.onAuthChange((event,user) => {
      if (!App.user) return;
      if (event === 'SIGNED_OUT') { App.user=null; State.db=emptyDB(); closeModal(); render(); }
      else if (user && user.id !== App.user.id) location.reload();
    });
    Cloud.subscribe(() => refreshCloud());
    window.addEventListener('focus', () => refreshCloud());
    window.addEventListener('online', () => refreshCloud());
    window.addEventListener('offline', () => updateSync('offline'));
    setInterval(() => { if (!document.hidden) refreshCloud(); }, 60000);
  } else {
    const sid = getSession(); App.user = sid && State.db.users.find(x => x.id === sid && roleFits(x) && x.active) || null;
  }
  const h = location.hash.slice(1); App.page = PAGES[h] && h !== 'member' ? h : DEFAULT_PAGE;
  if (App.user) { try { history.replaceState({page: App.page}, '', '#' + App.page); } catch {} }
  render();
}
export { ROLE, configureHooks, APP_VERSION, DB_KEY, THEME_KEY, LANG_KEY, SESSION_KEY, $, $$, esc, EN_DATES, BN_DATES, MONTHS, MON, DOW, LANG, applyLang, setLang, T, firstOfMonth, monthKey, monthLabel, fmtDate, fmtDay, fmtTime, fmtDT, timeAgo, Tn, dayLabel, initials, uid, isAdminRole, roleFits, isSuper, roleLabel, isEmail, shortUrl, pct, firstName, TAGS, COLORS, MIN_PW, ICONS, icon, logo, avatar, ST, stLabel, statusBadge, emptyHTML, kpi, pbar, postThumb, postMedia, liveBadge, tagHTML, normalizeDB, loadDB, storeUse, waNumber, modUrl, saveDB, State, App, logEvent, commit, noteText, userById, postById, activeMods, canShare, byDateTime, monthPosts, sharesOfPost, groupById, shareFor, taskKey, targetName, profileAssignees, tasksFor, taskRows, tasksOfUser, targetBadge, monthShares, deadlineH, dueAt, isLate, lateBadge, dueBadge, statsFor, sheetPeople, leaderboard, shareablePosts, activeNotice, toast, openModal, closeModal, confirmBox, copyText, download, getTheme, setTheme, KEEP_KEY, LOCK_KEY, getSession, setSession, logout, getLock, setLock, unreadCount, bellBtn, closePop, openNotif, langBtn, renderLogin, renderShell, renderPage, render, calendarHTML, lbRows, leaderboardPage, sheetData, shortTarget, assignSummary, sheetPage, exportSheetCSV, postInfo, shareRows, readImage, profilePage, photoInput, Actions, Forms, boot, BN, setPassword, checkPassword, MODE, Cloud, pad, ymd, parseYmd, addDays, todayYmd, calendarNow, postAt, isLive, isUrl, isFbUrl, cleanLink, sameLink, looksLikePost, csvCell, emptyDB };

function errorText(error) {
 const message = String(error?.message || error || 'Could not save. Please try again.');
 if (/fetch|network|timeout|abort/i.test(message)) return T('Connection failed. Your change was not confirmed. Refresh before trying again.');
 if (/duplicate key/i.test(message)) return T('This link, username or task is already recorded. Refresh and check the existing record.');
 return T(message);
}
function syncHTML() { return MODE !== 'cloud' ? '' : '<button class="sync-state" data-action="sync" title="'+T('Refresh data')+'"><span class="sync-dot"></span><span id="syncText">'+T(State.sync === 'saving' ? 'Saving...' : State.sync === 'error' ? 'Refresh needed' : navigator.onLine ? 'Connected' : 'Offline')+'</span></button>'; }
function updateSync(status) { State.sync = status; document.body.dataset.sync = status; const el = $('#syncText'); if (el) el.textContent = T(status === 'saving' ? 'Saving...' : status === 'refreshing' ? 'Refreshing...' : status === 'error' ? 'Refresh needed' : status === 'offline' ? 'Offline' : 'Connected'); }
async function runEvent(fn) {
 if (State.saving || State.actionBusy || State.refreshing) return;
 State.actionBusy = true; document.body.classList.add('is-busy');
 try { await fn(); if (State.pendingWrite) await State.pendingWrite; }
 catch (error) { toast(errorText(error), 'error'); }
 finally { State.actionBusy = false; document.body.classList.remove('is-busy'); }
}
async function refreshCloud(force = false) {
 if (MODE !== 'cloud' || !App.user || State.saving || State.refreshing || State.actionBusy && !force) return;
 if ($('#modal.open form') || $('form[data-dirty]')) { State.refreshNeeded = true; if (force) toast(T('Save or close the form before refreshing.'), 'error'); return; }
 State.refreshing = true; document.body.classList.add('is-refreshing'); updateSync('refreshing');
 try {
  const id = App.user.id, reopen = App.modalPost;
  const next = await Cloud.maybeLoad(force); if (next) State.db = normalizeDB(next); const member = userById(id);
  if (!member?.active || !roleFits(member)) { await logout(); return; }
  App.user = member; State.syncedAt = new Date(); updateSync('saved');
  render(); if (reopen && postById(reopen)) openPost(reopen); State.refreshNeeded = false;
 } catch(error) { updateSync('error'); if (force) toast(errorText(error), 'error'); if (error.code === '42501') await logout(); }
 finally { State.refreshing = false; document.body.classList.remove('is-refreshing'); }
}
function renderSetup() {
 document.title = 'Setup required | UBEI ShareHub';
 $('#app').innerHTML = '<main class="setup-screen"><div class="card"><div class="card-b"><h1>UBEI ShareHub</h1><h2>সংযোগ সেটআপ বাকি</h2><p>Supabase URL এবং public publishable key দিয়ে build করুন। প্রস্তুত করার ধাপ START-HERE.html ফাইলে আছে।</p><p>প্রতিষ্ঠানের ডেটা ব্যবহারের আগে database migration এবং প্রথম Super Admin তৈরি করতে হবে।</p><p class="muted">No production credentials or sample accounts are enabled.</p></div></div></main>';
}
Actions.sync = () => refreshCloud(true);
// Keep keyboard focus inside modal dialogs, including Shift+Tab.
document.addEventListener('keydown', e => {
 if (e.key !== 'Tab' || !$('#modal.open')) return;
 const items = [...$('#modal').querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x => !x.disabled && x.type !== 'hidden' && x.getClientRects().length);
 if (!items.length) return;
 const first=items[0], last=items.at(-1);
 if (e.shiftKey && (document.activeElement === first || !$('#modal').contains(document.activeElement))) { e.preventDefault(); last.focus(); }
 else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
// Existing calendar and sheet cells now expose their actions to keyboard users.
const actionsObserver = new MutationObserver(() => {
 for (const el of document.querySelectorAll('[data-action]:not(button):not(a):not(input):not(select):not(label)')) {
  if (el.querySelector('button,a,input,select') || el.closest('button,a')) continue;
  el.tabIndex=0; el.setAttribute('role','button');
 }
});
actionsObserver.observe($('#app'), {subtree:true,childList:true});
export {refreshCloud,errorText,runEvent};
