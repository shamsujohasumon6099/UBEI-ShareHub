/** Domain rules shared by the UI and tests. Institution time is always Dhaka. */
export const TIME_ZONE = 'Asia/Dhaka';
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid calendar date');
  const [y, m, d] = s.split('-').map(Number), date = new Date(y, m - 1, d);
  if (ymd(date) !== s) throw new Error('Invalid calendar date');
  return date;
};
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayYmd = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
export const calendarNow = () => parseYmd(todayYmd());
export const postAt = p => new Date(`${p.date}T${p.time || '00:00'}:00+06:00`);
export const isLive = (p, now = Date.now()) => postAt(p).getTime() <= now;
export const isUrl = value => {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
};
export const isFbUrl = value => {
  if (!isUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return /(^|\.)(facebook\.com|fb\.com|fb\.watch|fb\.me)$/.test(host);
};
const TRACK_PARAMS = /^(mibextid|rdid|share_url|__cft__.*|__tn__|ref|refsrc|_rdr|_rdc|paipv|eav|sfnsn|extid|notif_id|notif_t|comment_tracking|locale|hoisted_section_header_type|acontext|app|s|fs|sk|wtsid|mibext|utm_.*|fbclid|context|source|entry_point)$/i;
export function cleanLink(value) {
  const raw = String(value || '').trim();
  if (!isUrl(raw)) return raw;
  const u = new URL(raw);
  u.protocol = 'https:'; u.hash = '';
  if (/^(?:(?:m|web|mbasic|mobile|touch|business|free)\.)?facebook\.com$/i.test(u.hostname)) u.hostname = 'www.facebook.com';
  for (const k of [...u.searchParams.keys()]) if (TRACK_PARAMS.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.toString().replace(/\?$/, '').replace(/\/+$/, '');
}
// Facebook's opaque path tokens are case-sensitive. Never lowercase the path.
export const sameLink = (a, b) => cleanLink(a) === cleanLink(b);
export function looksLikePost(value) {
  if (!isFbUrl(value)) return false;
  const u = new URL(cleanLink(value)), p = u.pathname.split('/').filter(Boolean);
  if (/^(?:fb\.watch|fb\.me)$/.test(u.hostname)) return p.length > 0;
  if (['profile.php', 'groups', 'pages', 'people'].includes(p[0]) && p.length < (p[0] === 'groups' ? 4 : 3)) return false;
  if (['story_fbid', 'fbid', 'v'].some(k => u.searchParams.has(k))) return true;
  if (p[0] === 'share') return p.length >= 3;
  if (['reel', 'watch', 'videos', 'photos'].includes(p[0])) return p.length >= 2;
  return p.length >= 3 && p.some(x => ['posts', 'permalink', 'videos', 'photos', 'reel'].includes(x));
}
export const csvCell = value => {
  let s = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const emptyDB = () => ({users: [], posts: [], shares: [], groups: [], log: [], settings: {
  demo: false, pageName: 'Uttar Bango Engineering Institute', pageUrl: 'https://www.facebook.com/ubei.edu.bd', deadlineHours: 24,
}});
