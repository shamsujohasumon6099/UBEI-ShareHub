import {ymd,addDays} from '../lib/domain.js';
export function seedDB() {
  let s = 11; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rstr = n => Array.from({ length: n }, () => chars[Math.floor(rnd() * chars.length)]).join('');
  const users = [
    { id: 'u_admin', name: 'Super Admin', username: 'admin', password: 'admin123', role: 'superadmin', color: '#6366F1', active: true, fb: '', email: 'owner@example.com' },
    { id: 'u_a2', name: 'Office Manager', username: 'manager', password: '1234', role: 'admin', color: '#8B5CF6', active: true, fb: '', email: 'manager@example.com' },
    { id: 'u_m1', name: 'Rahim Uddin', username: 'rahim', email: 'rahim@example.com', password: '1234', role: 'moderator', color: '#0EA5E9', active: true, fb: 'https://www.facebook.com/rahim.demo' },
    { id: 'u_m2', name: 'Nusrat Jahan', username: 'nusrat', email: 'nusrat@example.com', password: '1234', role: 'moderator', color: '#EC4899', active: true, fb: 'https://www.facebook.com/nusrat.demo' },
    { id: 'u_m3', name: 'Tanvir Ahmed', username: 'tanvir', email: 'tanvir@example.com', password: '1234', role: 'moderator', color: '#10B981', active: true, fb: 'https://www.facebook.com/tanvir.demo' },
    { id: 'u_m4', name: 'Sadia Islam', username: 'sadia', email: 'sadia@example.com', password: '1234', role: 'moderator', color: '#F59E0B', active: true, fb: 'https://www.facebook.com/sadia.demo' },
  ];
  const titles = [
    ['Admission Open: New Session', 'Admission is open! Limited seats, apply today. Message us for details.', 'Promo'],
    ['Weekend Special Offer', '20% off on every course this weekend. Offer valid for 2 days only.', 'Offer'],
    ['Free Career Seminar', 'Free career seminar this Friday at 4 PM. Registration link in the comments.', 'Event'],
    ['Student Success Story', 'Meet one of our students and their success story. You could be next!', 'Update'],
    ['New Batch Starting Soon', 'A new batch is starting. Special early bird price for early registration.', 'Promo'],
    ['Office Holiday Notice', 'The office will be closed for the holiday. Online support stays open.', 'Update'],
    ['Flash Sale 48 Hours', '48 hour flash sale! Click the link to grab the offer.', 'Offer'],
    ['Live Q&A Session', 'Join our live Q&A and get all your questions answered.', 'Event'],
    ['Customer Review Highlight', 'What our customers say about us. Thank you for the trust!', 'Update'],
    ['Referral Bonus Program', 'Refer a friend and get a bonus. Message us for details.', 'Promo'],
  ];
  const groups = [
    { id: 'g_1', name: 'Dhaka Job Seekers Hub', url: 'https://www.facebook.com/groups/dhakajobseekers.demo', note: 'About 120k members', active: true },
    { id: 'g_2', name: 'Student Community BD', url: 'https://www.facebook.com/groups/studentcommunitybd.demo', note: 'Posts need approval', active: true },
    { id: 'g_3', name: 'Career Tips Bangladesh', url: 'https://www.facebook.com/groups/careertipsbd.demo', note: '', active: true },
  ];
  const times = ['10:00', '13:30', '18:00', '20:30'];
  const posts = [], shares = [];
  const now = new Date(), today = ymd(now), tomorrow = addDays(today, 1);
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
  const mods = users.filter(u => u.role === 'moderator');
  let i = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = ymd(d), forced = date === today || date === tomorrow;
    const r0 = rnd();
    if (!forced && r0 > 0.52) continue;
    const t = titles[i % titles.length]; i++;
    const time = date === today ? '09:30' : times[Math.floor(rnd() * times.length)];
    const p = { id: 'p_' + i, title: t[0], caption: t[1], tag: t[2], date, time, image: '',
      fbLink: 'https://www.facebook.com/yourpage/posts/pfbid0' + rstr(14), createdAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0).toISOString(), createdBy: i % 3 === 0 ? 'u_a2' : 'u_admin',
      assign: 'all', assignees: [], groupShare: false, groupTasks: [] };
    if (i % 4 === 2) { p.assign = 'selected'; p.assignees = mods.filter((m, k) => k !== i % mods.length).map(m => m.id); }
    if (i % 3 !== 0 || date === today) { p.groupShare = true; const a = mods[i % mods.length], b = mods[(i + 2) % mods.length]; p.groupTasks = [{ userId: a.id, groupId: groups[i % 3].id }, { userId: b.id, groupId: groups[(i + 1) % 3].id }]; }
    posts.push(p);
    if (date > today) continue;
    const [hh, mm] = time.split(':').map(Number);
    const tasks = (p.assign === 'selected' ? p.assignees : mods.map(m => m.id)).map(u => ({ userId: u, groupId: null })).concat(p.groupShare ? p.groupTasks : []);
    tasks.forEach((tk, k) => {
      if (date === today ? k % 3 === 2 : rnd() > 0.8) return;
      let sub = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
      sub = new Date(sub.getTime() + (20 + Math.floor(rnd() * 400)) * 60000);
      if (sub > now) sub = new Date(now.getTime() - (5 + Math.floor(rnd() * 90)) * 60000);
      const age = (now - d) / 86400000;
      let status = 'pending', checkedAt = null, note = '';
      if (age > 2 || (age > 1 && rnd() < 0.5) || (date === today && k % 3 === 0)) {
        status = rnd() < 0.9 ? 'verified' : 'rejected';
        checkedAt = new Date(Math.min(now.getTime(), sub.getTime() + 5 * 3600000)).toISOString();
        if (status === 'rejected') note = tk.groupId ? 'The group post is not approved yet. Share again once it is approved.' : 'Link does not open. Make the post Public and share again.';
      }
      const g = tk.groupId ? groups.find(x => x.id === tk.groupId) : null;
      shares.push({ id: 's_' + rstr(8), postId: p.id, userId: tk.userId, groupId: tk.groupId, link: g ? g.url.replace('.demo', '.demo/posts/') + rstr(10) + '/' : 'https://www.facebook.com/share/p/' + rstr(12) + '/',
        submittedAt: sub.toISOString(), status, checkedAt, checkedBy: status === 'pending' ? null : (rnd() < 0.6 ? 'u_admin' : 'u_a2'), note });
    });
  }
  return { version: 3, users, groups, posts, shares, log: [], settings: { pageName: 'Your Facebook Page', pageUrl: 'https://www.facebook.com/yourpage', demo: true, deadlineHours: 24 } };
}
