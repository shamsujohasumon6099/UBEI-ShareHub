import {seedDB} from '../demo/seed.js';
import {$,$$} from '../core/application.js';
import { APP_VERSION, esc, MON, DOW, LANG, setLang, T, firstOfMonth, monthLabel, fmtDate, fmtDay, fmtTime, fmtDT, timeAgo, Tn, dayLabel, uid, isAdminRole, isSuper, roleLabel, isEmail, shortUrl, pct, firstName, TAGS, COLORS, MIN_PW, icon, avatar, ST, stLabel, statusBadge, emptyHTML, kpi, pbar, postThumb, postMedia, liveBadge, tagHTML, normalizeDB, storeUse, waNumber, modUrl, saveDB, State, App, logEvent, commit, noteText, userById, postById, activeMods, canShare, byDateTime, monthPosts, sharesOfPost, groupById, targetName, taskRows, targetBadge, monthShares, deadlineH, isLate, lateBadge, statsFor, leaderboard, shareablePosts, activeNotice, toast, openModal, closeModal, confirmBox, copyText, download, logout, renderPage, render, calendarHTML, lbRows, leaderboardPage, shortTarget, assignSummary, sheetPage, postInfo, shareRows, readImage, profilePage, photoInput, Actions, Forms, boot, setPassword, pad, ymd, parseYmd, addDays, todayYmd, isLive, isUrl, isFbUrl, cleanLink, sameLink, looksLikePost, configureHooks, MODE, ROLE } from '../core/application.js';
import {runEvent,Cloud} from '../core/application.js';
import { installCloudUI } from '../services/cloud-ui.js';
/* =====================================================
   UBEI ShareHub . ADMIN app
   ===================================================== */
const DEFAULT_PAGE = 'overview';
const pendingAll = () => State.db.shares.filter(s => s.status === 'pending');
const NAV = [
  { section: 'Main' },
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'calendar', label: 'Content Calendar', icon: 'calendar' },
  { id: 'posts', label: 'Posts', icon: 'file' },
  { id: 'verify', label: 'Verification', icon: 'checkCircle', badge: () => pendingAll().length || '' },
  { section: 'Team' },
  { id: 'moderators', label: 'Moderators', icon: 'users' },
  { id: 'groups', label: 'FB Groups', icon: 'grid' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { id: 'sheet', label: 'Monthly Sheet', icon: 'table' },
  { id: 'activity', label: 'Activity Log', icon: 'history' },
  { id: 'admins', label: 'Admins', icon: 'shield', show: () => isSuper() },
  { section: 'Account' },
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
];
const CTA = () => `<button class="btn primary" data-action="new-post">${icon('plus', 16)}<span class="hide-sm">${T('New Post')}</span></button>`;

function CHIP(p) {
  const tr = taskRows(p).filter(r => r.assigned), done = tr.filter(r => r.share).length, pend = sharesOfPost(p.id).some(s => s.status === 'pending');
  let c = 'c-none';
  if (!isLive(p)) c = 'c-sched'; else if (pend) c = 'c-pending'; else if (done) c = 'c-verified';
  const meta = isLive(p) ? (tr.length ? `${done}/${tr.length}` : T('No task')) : (p.time ? fmtTime(p.time) : T('Soon'));
  return `<button class="chip ${c}" style="--chip:${TAGS[p.tag] || TAGS.Other}" data-action="open-post" data-id="${p.id}" title="${esc(p.title)}"><i class="dot"></i><span class="chip-t">${esc(p.title)}</span><span class="chip-m">${meta}</span></button>`;
}
const whoLink = u => u ? `<span class="person clickable" data-action="view-mod" data-id="${u.id}">${avatar(u, 30)}<span><b>${esc(u.name)}</b><small>@${esc(u.username)}</small></span></span>` : '';

/* ---------------- pages ---------------- */
const PAGES = {
  overview: {
    title: 'Overview', sub: () => T('{page} share performance, {m}', { page: esc(State.db.settings.pageName || T('Facebook page')), m: monthLabel(App.month) }),
    render() {
      const posts = monthPosts(), live = shareablePosts(), sh = monthShares();
      const v = sh.filter(s => s.status === 'verified').length, pe = sh.filter(s => s.status === 'pending').length, rj = sh.filter(s => s.status === 'rejected').length;
      const trs = live.flatMap(p => taskRows(p).filter(r => r.assigned)), possible = trs.length, vt = trs.filter(r => r.share && r.share.status === 'verified').length;
      const gShares = sh.filter(s => s.groupId).length;
      const tdy = todayYmd(), tmr = addDays(tdy, 1);
      const nToday = State.db.posts.filter(p => p.date === tdy).length, nTmr = State.db.posts.filter(p => p.date === tmr).length;
      const kp = `<div class="grid kpis">
        ${kpi(T('Posts today'), nToday, T('{n} scheduled tomorrow', { n: nTmr }), 'calendar', 'fb')}
        ${kpi(T('Posts this month'), posts.length, T('{l} live, {s} scheduled', { l: posts.filter(isLive).length, s: posts.filter(p => !isLive(p)).length }), 'file', 'accent')}
        ${kpi(T('Shares submitted'), sh.length, T('{p} profile, {g} group', { p: sh.length - gShares, g: gShares }), 'share', 'fb')}
        ${kpi(T('Pending review'), pe, T(pe ? 'Needs a manual check' : 'All checked'), 'clock', 'warn')}
        ${kpi(T('Verified shares'), v, T('{n} rejected', { n: rj }), 'checkCircle', 'success')}
        ${kpi(T('Task coverage'), pct(vt, possible) + '%', T('{v} of {t} assigned tasks verified', { v: vt, t: possible }), 'target', 'accent')}
      </div>`;
      const pend = pendingAll().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6);
      const pendHTML = pend.length ? pend.map(s => { const u = userById(s.userId), p = postById(s.postId); if (!u || !p) return ''; return `<div class="list-row">${avatar(u, 32)}<div class="grow"><b class="clickable" data-action="view-mod" data-id="${u.id}">${esc(u.name)}</b><small>${esc(p.title)} . ${esc(targetName(s.groupId))} . ${timeAgo(s.submittedAt)}${lateBadge(s)}</small></div><a class="icon-btn sm" href="${esc(s.link)}" target="_blank" rel="noopener" title="${T('Open shared link')}" aria-label="${T('Open shared link')}">${icon('ext', 15)}</a><button class="icon-btn sm ok" data-action="verify" data-id="${s.id}" data-s="verified" title="${T('Verify')}" aria-label="${T('Verify')}">${icon('check', 15)}</button><button class="icon-btn sm bad" data-action="verify" data-id="${s.id}" data-s="rejected" title="${T('Reject')}" aria-label="${T('Reject')}">${icon('x', 15)}</button></div>`; }).join('') : emptyHTML('checkCircle', T('The review queue is empty'), T('New shares will show up here.'));
      return `${setupHTML()}${healthHTML()}${kp}${noticeBar()}${dayStatusHTML()}
      <div class="grid cols-2e" style="margin-bottom:16px">
        <div class="card"><div class="card-h"><div><h3>${T('Post timeline')}</h3><p>${T('Tomorrow, today, then older posts by date')}</p></div><button class="btn sm primary" data-action="new-post" data-date="${tdy}">${icon('plus', 14)} ${T('Add post for today')}</button></div>${timelineHTML()}</div>
        <div class="card"><div class="card-h"><div><h3>${T('Needs review')}</h3><p>${T('Open the link, check it, then verify')}</p></div><div class="post-btns">${pendingAll().length ? `<button class="btn sm primary" data-action="review-start">${icon('zap', 14)} ${T('Quick review ({n})', { n: pendingAll().length })}</button>` : ''}<button class="btn sm ghost" data-action="nav" data-page="verify">${T('Open queue')} ${icon('chevR', 14)}</button></div></div>${pendHTML}</div>
      </div>
      <div class="grid cols-2">
        <div class="card"><div class="card-h"><div><h3>${T('Daily shares')}</h3><p>${T('Shares counted by the post date')}</p></div><div class="legend"><span><i style="--d:var(--accent-btn)"></i>${T('Verified')}</span><span><i style="--d:color-mix(in srgb,var(--accent-btn) 35%,transparent)"></i>${T('Pending / rejected')}</span></div></div><div class="card-b">${chartHTML()}</div></div>
        <div class="card"><div class="card-h"><div><h3>${T('Top moderators')}</h3><p>${T('By verified shares')}</p></div><button class="btn sm ghost" data-action="nav" data-page="leaderboard">${T('See all')} ${icon('chevR', 14)}</button></div><div style="padding:6px 0">${lbRows(5)}</div></div>
      </div>`;
    }
  },
  calendar: {
    title: 'Content Calendar', sub: () => T('Click a date to add a post, click a post to see details'),
    render() {
      return `<div class="toolbar"><div class="legend"><span><i style="--d:#10B981"></i>${T('All reviewed')}</span><span><i style="--d:#F59E0B"></i>${T('Review pending')}</span><span><i style="--d:#94A3B8"></i>${T('No shares yet')}</span><span><i class="dash"></i>${T('Scheduled')}</span><span class="muted">${T('3/5 means 3 of 5 tasks (profile + group) have a link')}</span></div></div>${calendarHTML()}`;
    }
  },
  posts: {
    title: 'Posts', search: 'Search posts...', sub: () => Tn(monthPosts().length, '{n} post, {m}', '{n} posts, {m}', { m: monthLabel(App.month) }),
    render() {
      const q = App.q.trim().toLowerCase();
      const list = monthPosts().filter(p => !q || (p.title + ' ' + p.caption + ' ' + p.tag).toLowerCase().includes(q));
      if (!list.length) return `<div class="card">${emptyHTML('file', T(q ? 'No posts match your search' : 'No posts this month'), q ? '' : T('Click "New Post" at the top.'))}</div>`;
      const rows = list.map(p => {
        const ss = sharesOfPost(p.id), tr = taskRows(p).filter(r => r.assigned), done = tr.filter(r => r.share).length, v = ss.filter(s => s.status === 'verified').length, pe = ss.filter(s => s.status === 'pending').length, gids = [...new Set(tr.filter(r => r.groupId).map(r => r.groupId))], by = userById(p.createdBy);
        return `<tr><td><div class="cell-post clickable" data-action="open-post" data-id="${p.id}">${postThumb(p)}<div><b>${esc(p.title)}</b><small>${tagHTML(p)}</small></div></div></td>
          <td><b>${fmtDate(p.date)}</b><br><small class="muted">${p.time ? fmtTime(p.time) : ''}</small>${p.createdAt ? `<br><small class="muted" title="${T('Added to dashboard')}">+ ${fmtDT(p.createdAt)}${by ? ', ' + esc(firstName(by)) : ''}</small>` : ''}</td>
          <td>${liveBadge(p)}</td>
          <td>${p.fbLink ? `<a class="lnk" href="${esc(p.fbLink)}" target="_blank" rel="noopener">${icon('fb', 14)}<span>${esc(shortUrl(p.fbLink))}</span></a>` : `<span class="muted">${T('Not set')}</span>`}</td>
          <td>${assignSummary(p)}<div class="wheres" style="margin-top:4px">${gids.length ? gids.map(targetBadge).join('') : `<span class="muted small">${T('No group')}</span>`}</div></td>
          <td style="min-width:140px">${isLive(p) ? (tr.length ? pbar(done, tr.length) : `<span class="muted small">${T('No task')}</span>`) : `<span class="muted small">${Tn(tr.length, '{n} task, after publish', '{n} tasks, after publish')}</span>`}</td>
          <td class="num"><b>${v}</b>${pe ? ` <span class="badge b-pending">${T('{n} pending', { n: pe })}</span>` : ''}</td>
          <td><div class="acts"><button class="icon-btn sm" data-action="open-post" data-id="${p.id}" title="${T('View')}" aria-label="${T('View')}">${icon('eye', 15)}</button><button class="icon-btn sm" data-action="dup-post" data-id="${p.id}" title="${T('Duplicate')}" aria-label="${T('Duplicate')}">${icon('dup', 15)}</button><button class="icon-btn sm" data-action="edit-post" data-id="${p.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button><button class="icon-btn sm bad" data-action="delete-post" data-id="${p.id}" title="${T('Delete')}" aria-label="${T('Delete')}">${icon('trash', 15)}</button></div></td></tr>`;
      }).join('');
      return `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>${T('Post')}</th><th>${T('Date')}</th><th>${T('Status')}</th><th>${T('Page post link')}</th><th>${T('Assigned to')}</th><th>${T('Submitted / Tasks')}</th><th class="num">${T('Verified')}</th><th class="num">${T('Actions')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  verify: {
    title: 'Verification', month: false, search: 'Search moderator or post...', sub: () => T('Open each shared link, check it by hand, then verify or reject'),
    render() {
      const q = App.q.trim().toLowerCase(), tab = App.tab, mf = App.modFilter, wf = App.whereFilter || '';
      const base = State.db.shares.filter(s => (!mf || s.userId === mf) && (!wf || (wf === 'profile' ? !s.groupId : wf === 'group' ? !!s.groupId : s.groupId === wf)) && (!q || ((userById(s.userId) || {}).name + ' ' + (postById(s.postId) || {}).title + ' ' + targetName(s.groupId) + ' ' + s.link).toLowerCase().includes(q)));
      const cnt = { pending: 0, verified: 0, rejected: 0 }; base.forEach(s => cnt[s.status]++);
      const list = base.filter(s => tab === 'all' || s.status === tab).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      [...App.sel].forEach(id => { if (!list.some(s => s.id === id)) App.sel.delete(id); });
      const tabs = [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-action="set" data-key="tab" data-val="${k}">${T(l)}<em>${k === 'all' ? base.length : cnt[k]}</em></button>`).join('');
      const modSel = `<select class="input" data-filter="modFilter" aria-label="${T('Filter by moderator')}"><option value="">${T('All moderators')}</option>${State.db.users.filter(u => u.role === 'moderator').map(u => `<option value="${u.id}" ${mf === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
      const whereSel = `<select class="input" data-filter="whereFilter" aria-label="${T('Filter by where')}"><option value="">${T('Profile + Group')}</option><option value="profile" ${wf === 'profile' ? 'selected' : ''}>${T('Profile only')}</option><option value="group" ${wf === 'group' ? 'selected' : ''}>${T('All groups')}</option>${State.db.groups.map(g => `<option value="${g.id}" ${wf === g.id ? 'selected' : ''}>${T('Group')}: ${esc(g.name)}</option>`).join('')}</select>`;
      const bulk = App.sel.size ? `<span class="muted small">${T('{n} selected', { n: `<b>${App.sel.size}</b>` })}</span><button class="btn sm" data-action="open-sel-links">${icon('ext', 14)} ${T('Open selected')}</button><button class="btn sm success" data-action="bulk" data-s="verified">${icon('check', 14)} ${T('Verify selected')}</button><button class="btn sm" data-action="bulk" data-s="rejected">${icon('x', 14)} ${T('Reject')}</button>` : '';
      const nPend = base.filter(s => s.status === 'pending').length;
      const toolbar = `<div class="toolbar"><div class="tabs">${tabs}</div>${modSel}${whereSel}<span class="spacer"></span>${bulk || (nPend ? `<button class="btn sm primary" data-action="review-start" data-filtered="1">${icon('zap', 14)} ${T('Quick review ({n})', { n: nPend })}</button>` : '')}</div>`;
      if (!list.length) return toolbar + `<div class="card">${emptyHTML('checkCircle', T(tab === 'pending' ? 'No pending shares' : 'Nothing found'))}</div>`;
      const allSel = list.every(s => App.sel.has(s.id));
      const rows = list.map(s => { const u = userById(s.userId), p = postById(s.postId); if (!u || !p) return ''; const c = userById(s.checkedBy); return `<tr><td><input type="checkbox" data-sel="${s.id}" ${App.sel.has(s.id) ? 'checked' : ''} aria-label="${T('Select')}"></td><td>${whoLink(u)}</td><td><div class="cell-post clickable" data-action="open-post" data-id="${p.id}">${postThumb(p)}<div><b>${esc(p.title)}</b><small>${fmtDate(p.date)}</small></div></div></td><td>${targetBadge(s.groupId)}${s.groupId && groupById(s.groupId) ? `<br><a class="small" href="${esc(groupById(s.groupId).url)}" target="_blank" rel="noopener">${T('Open group')}</a>` : ''}</td><td><a class="lnk" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('ext', 14)}<span>${esc(shortUrl(s.link))}</span></a></td><td><span title="${fmtDT(s.submittedAt)}">${timeAgo(s.submittedAt)}</span>${lateBadge(s)}${s.editedAt ? `<br><small class="muted">${T('edited')}</small>` : ''}</td><td>${statusBadge(s.status)}${c && s.status !== 'pending' ? `<br><small class="muted">${T('by {name}', { name: esc(firstName(c)) })}</small>` : ''}${s.note ? `<br><small class="muted" title="${esc(noteText(s.note))}">${esc(noteText(s.note).slice(0, 28))}${noteText(s.note).length > 28 ? '...' : ''}</small>` : ''}</td><td><div class="acts">${s.status !== 'verified' ? `<button class="icon-btn sm ok" data-action="verify" data-id="${s.id}" data-s="verified" title="${T('Verify')}" aria-label="${T('Verify')}">${icon('check', 15)}</button>` : ''}${s.status !== 'rejected' ? `<button class="icon-btn sm bad" data-action="verify" data-id="${s.id}" data-s="rejected" title="${T('Reject')}" aria-label="${T('Reject')}">${icon('x', 15)}</button>` : ''}<button class="icon-btn sm" data-action="edit-share" data-id="${s.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button><button class="icon-btn sm bad" data-action="delete-share" data-id="${s.id}" title="${T('Delete')}" aria-label="${T('Delete')}">${icon('trash', 15)}</button></div></td></tr>`; }).join('');
      return toolbar + `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" data-sel-all ${allSel ? 'checked' : ''} aria-label="${T('Select all')}"></th><th>${T('Moderator')}</th><th>${T('Post')}</th><th>${T('Where')}</th><th>${T('Shared link')}</th><th>${T('Submitted')}</th><th>${T('Status')}</th><th class="num">${T('Actions')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  moderators: {
    title: 'Moderators', search: 'Search moderator...', sub: () => T('{a} active, {i} inactive', { a: activeMods().length, i: State.db.users.filter(u => u.role === 'moderator' && !u.active).length }),
    render() {
      const q = App.q.trim().toLowerCase();
      const list = State.db.users.filter(u => u.role === 'moderator' && (!q || (u.name + ' ' + u.username + ' ' + (u.email || '')).toLowerCase().includes(q))).sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
      const tb = `<div class="toolbar"><span class="muted small">${T('Stats for {m}', { m: monthLabel(App.month) })}</span><span class="spacer"></span><button class="btn primary" data-action="new-mod">${icon('plus', 16)} ${T('Add moderator')}</button></div>`;
      if (!list.length) return tb + `<div class="card">${emptyHTML('users', T('No moderators yet'), T('Click "Add moderator".'))}</div>`;
      const rows = list.map(u => { const st = statsFor(u.id), all = State.db.shares.filter(s => s.userId === u.id && s.status === 'verified').length; return `<tr><td>${whoLink(u)}</td><td>${u.fb ? `<a class="lnk" href="${esc(u.fb)}" target="_blank" rel="noopener">${icon('fb', 14)}<span>${esc(shortUrl(u.fb))}</span></a>` : `<span class="muted">${T('Not set')}</span>`}</td><td class="num">${st.expected}</td><td class="num">${st.profile}</td><td class="num">${st.group}</td><td class="num"><b style="color:var(--success)">${st.verified}</b></td><td class="num">${st.pending}</td><td class="num">${st.rejected}</td><td style="min-width:140px">${pbar(st.verified, st.expected, true)}</td><td class="num">${all}</td><td><small class="${u.lastLogin ? '' : 'muted'}" title="${u.lastLogin ? fmtDT(u.lastLogin) : ''}">${u.lastLogin ? timeAgo(u.lastLogin) : T('Never')}</small></td><td><label class="switch"><input type="checkbox" data-toggle-mod="${u.id}" ${u.active ? 'checked' : ''} aria-label="${T('Active')}"></label></td><td><div class="acts"><button class="btn sm" data-action="view-mod" data-id="${u.id}">${icon('eye', 14)} ${T('Activity')}</button><button class="icon-btn sm" data-action="edit-mod" data-id="${u.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button><button class="icon-btn sm bad" data-action="delete-mod" data-id="${u.id}" title="${T('Delete')}" aria-label="${T('Delete')}">${icon('trash', 15)}</button></div></td></tr>`; }).join('');
      return tb + `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>${T('Moderator')}</th><th>${T('FB profile')}</th><th class="num">${T('Tasks')}</th><th class="num">${T('Profile sent')}</th><th class="num">${T('Group sent')}</th><th class="num">${T('Verified')}</th><th class="num">${T('Pending')}</th><th class="num">${T('Rejected')}</th><th>${T('Completion')}</th><th class="num">${T('All-time verified')}</th><th>${T('Last login')}</th><th>${T('Active')}</th><th class="num">${T('Actions')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  groups: {
    title: 'FB Groups', search: 'Search group...', sub: () => T('{n} active groups. Choose who shares in which group from the post form.', { n: State.db.groups.filter(g => g.active).length }),
    render() {
      const q = App.q.trim().toLowerCase();
      const list = State.db.groups.filter(g => !q || (g.name + ' ' + g.url + ' ' + (g.note || '')).toLowerCase().includes(q)).sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
      const tb = `<div class="toolbar"><span class="muted small">${T('Tasks and shares for {m}', { m: monthLabel(App.month) })}</span><span class="spacer"></span><button class="btn primary" data-action="new-group">${icon('plus', 16)} ${T('Add group')}</button></div>`;
      if (!list.length) return tb + `<div class="card">${emptyHTML('grid', T(q ? 'No groups match your search' : 'No groups yet'), q ? '' : T('Click "Add group" and enter the Facebook group name and link.'))}</div>`;
      const posts = shareablePosts();
      const rows = list.map(g => {
        let tasks = 0, sent = 0, ver = 0, pen = 0; const who = new Set();
        posts.forEach(p => taskRows(p).forEach(r => { if (r.groupId !== g.id) return; if (r.assigned) { tasks++; who.add(r.userId); } if (r.share) { sent++; if (r.share.status === 'verified') ver++; if (r.share.status === 'pending') pen++; } }));
        const ppl = [...who].map(userById).filter(Boolean);
        return `<tr><td><div class="person"><span class="k-ic t-fb" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center">${icon('users', 17)}</span><div><b>${esc(g.name)}</b><small>${esc(g.note || '')}</small></div></div></td><td><a class="lnk" href="${esc(g.url)}" target="_blank" rel="noopener">${icon('ext', 14)}<span>${esc(shortUrl(g.url))}</span></a></td><td><div class="av-stack">${ppl.slice(0, 5).map(u => avatar(u, 26)).join('')}</div></td><td class="num">${tasks}</td><td class="num">${sent}</td><td class="num"><b style="color:var(--success)">${ver}</b></td><td class="num">${pen}</td><td style="min-width:120px">${pbar(ver, tasks, true)}</td><td><label class="switch"><input type="checkbox" data-toggle-group="${g.id}" ${g.active ? 'checked' : ''} aria-label="${T('Active')}"></label></td><td><div class="acts"><button class="icon-btn sm" data-action="edit-group" data-id="${g.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button><button class="icon-btn sm bad" data-action="delete-group" data-id="${g.id}" title="${T('Delete')}" aria-label="${T('Delete')}">${icon('trash', 15)}</button></div></td></tr>`;
      }).join('');
      return tb + `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>${T('Group')}</th><th>${T('Link')}</th><th>${T('Moderators')}</th><th class="num">${T('Tasks')}</th><th class="num">${T('Sent')}</th><th class="num">${T('Verified')}</th><th class="num">${T('Pending')}</th><th>${T('Completion')}</th><th>${T('Active')}</th><th class="num">${T('Actions')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  member: { title: 'Moderator activity', sub: () => { const u = userById(App.detailId); return u ? T('{name}\'s shares, {m}', { name: esc(u.name), m: monthLabel(App.month) }) : ''; }, render: memberPage },
  activity: { title: 'Activity Log', month: false, search: 'Search activity...', sub: () => T('Who did what, newest first'), render: activityPage },
  admins: {
    title: 'Admins', month: false, sub: () => T('Only a Super Admin can add, edit or remove admins'),
    render() {
      if (!isSuper()) return `<div class="card">${emptyHTML('lock', T('No access'), T('This page is for Super Admins only.'))}</div>`;
      const list = State.db.users.filter(u => isAdminRole(u.role)).sort((a, b) => (a.role === 'superadmin' ? 0 : 1) - (b.role === 'superadmin' ? 0 : 1) || a.name.localeCompare(b.name));
      const cnt = id => ({ posts: State.db.posts.filter(p => p.createdBy === id).length, checks: State.db.shares.filter(s => s.checkedBy === id).length });
      const rows = list.map(u => { const c = cnt(u.id), me = u.id === App.user.id; return `<tr class="${me ? 'mine' : ''}"><td><div class="person">${avatar(u, 36)}<div><b>${esc(u.name)}${me ? ' ' + T('(you)') : ''}</b><small>@${esc(u.username)}</small></div></div></td><td>${u.email ? esc(u.email) : `<span class="muted">${T('Not set')}</span>`}</td><td><span class="badge ${u.role === 'superadmin' ? 'b-sched' : 'b-none'}">${icon(u.role === 'superadmin' ? 'shield' : 'user', 12)}${roleLabel(u)}</span></td><td class="num">${c.posts}</td><td class="num">${c.checks}</td><td>${u.active ? `<span class="badge b-verified">${T('Active')}</span>` : `<span class="badge b-off">${T('Inactive')}</span>`}</td><td><div class="acts"><button class="icon-btn sm" data-action="edit-admin" data-id="${u.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button>${me ? '' : `<button class="icon-btn sm bad" data-action="delete-admin" data-id="${u.id}" title="${T('Delete')}" aria-label="${T('Delete')}">${icon('trash', 15)}</button>`}</div></td></tr>`; }).join('');
      return `<div class="toolbar"><div class="note" style="margin:0;flex:1">${icon('shield', 16)}<span>${T('<b>Super Admin</b> can do everything, including adding and removing admins. <b>Admin</b> can manage posts, verification, moderators and groups, but not admins, backups or resets.')}</span></div><button class="btn primary" data-action="new-admin">${icon('plus', 16)} ${T('Add admin')}</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>${T('Admin')}</th><th>${T('Email')}</th><th>${T('Role')}</th><th class="num">${T('Posts added')}</th><th class="num">${T('Shares checked')}</th><th>${T('Status')}</th><th class="num">${T('Actions')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  profile: { title: 'My Profile', month: false, sub: () => T('Photo, name, email and password'), render: profilePage },
  leaderboard: { title: 'Leaderboard', sub: () => T('Moderator ranking, {m}', { m: monthLabel(App.month) }), render: leaderboardPage },
  sheet: { title: 'Monthly Sheet', sub: () => T('Monthly share sheet and posting schedule, CSV / PDF export'), render: sheetPage },
  settings: {
    title: 'Settings', month: false, sub: () => T('Page info and backup'),
    render() {
      const s = State.db.settings, kb = Math.round(new Blob([JSON.stringify(State.db)]).size / 1024), used = storeUse();
      return `<div class="grid cols-2e">
      <div class="card"><div class="card-h"><div><h3>${T('Facebook page')}</h3><p>${T('The page name shown on the dashboard')}</p></div></div><div class="card-b"><form data-form="page-settings">
        <label class="field"><span>${T('Page name')}</span><input name="pageName" value="${esc(s.pageName || '')}" required></label>
        <label class="field"><span>${T('Page URL')}</span><input name="pageUrl" type="url" value="${esc(s.pageUrl || '')}" placeholder="https://www.facebook.com/yourpage"></label>
        <button class="btn primary" type="submit">${T('Save')}</button></form></div></div>
      <div class="card"><div class="card-h"><div><h3>${T('Share deadline')}</h3><p>${T('How long moderators have to share after the post time')}</p></div></div><div class="card-b">
        <label class="field"><span>${T('Deadline')}</span><select id="deadlineSel">${[0, 2, 4, 6, 12, 24, 48].map(h => `<option value="${h}" ${deadlineH() === h ? 'selected' : ''}>${h ? Tn(h, '{n} hour after the post time', '{n} hours after the post time') : T('No deadline')}</option>`).join('')}</select><small>${T('Moderators see a countdown. Links sent after it are marked "Late" in the verification list, the leaderboard and the CSV.')}</small></label></div></div>
      <div class="card"><div class="card-h"><div><h3>${T('Language')}</h3><p>${T('Each person can pick their own language')}</p></div></div><div class="card-b"><div class="seg"><label><input type="radio" name="langPick" value="en" ${LANG === 'en' ? 'checked' : ''}><span>English</span></label><label><input type="radio" name="langPick" value="bn" ${LANG === 'bn' ? 'checked' : ''}><span>বাংলা</span></label></div>
        <div class="storage"><div class="st-h"><b>${T('Browser storage')}</b><span class="muted small">${T('{p}% used', { p: used })}</span></div><div class="bar ${used > 75 ? 'warn' : ''}"><i style="width:${Math.max(2, used)}%"></i></div><small class="muted">${T('Photos take the most space. Use small images or image links.')}</small></div>
        <p class="muted small" style="margin:12px 0 0">UBEI ShareHub ${APP_VERSION}</p></div></div>
      ${isSuper() ? `<div class="card"><div class="card-h"><div><h3>${T('Backup & restore')}</h3><p>${T('Data is saved in this browser ({kb} KB)', { kb })}</p></div></div><div class="card-b">
        <div class="note warn">${icon('alert', 16)}<span>${T('In this version all data lives in this browser. To use the same data on another device, export a JSON backup and import it there. The online version (Supabase) will sync automatically.')}</span></div>
        <p class="muted small" style="margin:0 0 10px">${s.lastBackup ? T('Last backup: {t}', { t: fmtDT(s.lastBackup) }) : T('No backup downloaded yet')}</p>
        <div class="post-btns"><button class="btn" data-action="export-json">${icon('download', 16)} ${T('Export JSON')}</button><label class="btn" for="importFile">${icon('upload', 16)} ${T('Import JSON')}</label><input type="file" id="importFile" accept="application/json,.json" hidden></div></div></div>
      <div class="card"><div class="card-h"><div><h3>${T('Danger zone')}</h3><p>${T('These cannot be undone')}</p></div></div><div class="card-b"><div class="post-btns">
        <button class="btn" data-action="reset-demo">${icon('sliders', 16)} ${T('Reset demo data')}</button>
        <button class="btn danger-t" data-action="start-fresh">${icon('trash', 16)} ${T('Start fresh (delete everything)')}</button></div>
        <p class="muted small" style="margin:12px 0 0">${T('Start fresh keeps only your account. All posts, moderators, groups and shares are deleted.')}</p></div></div>` : `<div class="card"><div class="card-b"><div class="note">${icon('lock', 16)}<span>${T('Only a Super Admin can back up, import or reset data.')}</span></div></div></div>`}
      </div>`;
    }
  },
};

/* ---------------- daily share status (today by default, any day selectable) ---------------- */
function dayData(day) {
  const posts = State.db.posts.filter(p => p.date === day).sort(byDateTime);
  const ids = new Set(); posts.forEach(p => taskRows(p).forEach(r => ids.add(r.userId)));
  const people = State.db.users.filter(u => u.role === 'moderator' && (u.active || ids.has(u.id)));
  const tot = { T: 0, S: 0, V: 0, P: 0, R: 0, L: 0 };
  const rows = people.map(u => {
    const list = posts.flatMap(p => taskRows(p).filter(r => r.userId === u.id && (r.assigned || r.share)).map(r => ({ ...r, p })));
    const tasks = list.filter(r => r.assigned && canShare(r.p));
    const sent = tasks.filter(r => r.share).length, ver = tasks.filter(r => r.share && r.share.status === 'verified').length;
    const pend = tasks.filter(r => r.share && r.share.status === 'pending').length, rej = tasks.filter(r => r.share && r.share.status === 'rejected').length, miss = tasks.length - sent;
    const late = tasks.filter(r => r.share && isLate(r.share)).length;
    tot.T += tasks.length; tot.S += sent; tot.V += ver; tot.P += pend; tot.R += rej; tot.L += late;
    let st, tone, order;
    if (!list.length) { st = T('No task on this day'); tone = 'none'; order = 4; }
    else if (!tasks.length) { st = T('Post not ready yet'); tone = 'sched'; order = 3; }
    else if (miss) { st = rej ? T('{m} left, {r} rejected', { m: miss, r: rej }) : T('{m} left', { m: miss }); tone = 'bad'; order = 0; }
    else if (rej) { st = T('{r} rejected', { r: rej }); tone = 'bad'; order = 0; }
    else if (pend) { st = T('All shared, check pending'); tone = 'warn'; order = 1; }
    else { st = T('All done'); tone = 'ok'; order = 2; }
    return { u, list, tasks, sent, ver, pend, rej, miss, late, st, tone, order };
  }).sort((a, b) => a.order - b.order || a.u.name.localeCompare(b.u.name));
  return { day, posts, rows, tot };
}
function dayStatusHTML() {
  const t = todayYmd(), day = App.dayView || t, isToday = day === t;
  const { posts, rows, tot } = dayData(day);
  const nav = `<div class="day-nav"><button class="icon-btn sm" data-action="day" data-d="-1" aria-label="${T('Previous day')}">${icon('chevL', 15)}</button><input type="date" class="input day-pick" value="${day}" max="${addDays(t, 30)}" aria-label="${T('Pick a day')}"><button class="icon-btn sm" data-action="day" data-d="1" aria-label="${T('Next day')}">${icon('chevR', 15)}</button>${isToday ? '' : `<button class="btn sm" data-action="day" data-d="0">${T('Today')}</button>`}</div>`;
  const kicker = `<span class="th-kicker">${icon('calendar', 14)} ${T('Daily share status')} . ${dayLabel(day)}${isToday ? '' : ''}, ${fmtDay(day)}</span>`;
  if (!posts.length) {
    const prev = State.db.posts.filter(p => p.date < day).sort(byDateTime).pop();
    return `<div class="today-wrap"><div class="day-bar">${nav}</div><div class="today-hero empty"><div class="th-main">${kicker}<h2>${T(isToday ? 'No post has been added for today yet' : 'No posts on this day')}</h2><p>${T('Once a post is added for this day, you will see here who has shared and who has not.')}</p>
      <div class="post-btns" style="margin-top:14px"><button class="btn" data-action="new-post" data-date="${day}">${icon('plus', 15)} ${T('Add a post for this day')}</button>${prev ? `<button class="btn th-ghost" data-action="day-go" data-day="${prev.date}">${icon('chevL', 15)} ${T('Last post day: {d}', { d: fmtDay(prev.date) })}</button>` : ''}</div></div></div></div>`;
  }
  const withTask = rows.filter(r => r.tasks.length), doneP = withTask.filter(r => !r.miss && !r.rej).length, lagging = withTask.filter(r => r.miss || r.rej);
  const p100 = pct(tot.S, tot.T), allDone = tot.T > 0 && tot.S === tot.T && !tot.R;
  const names = lagging.slice(0, 3).map(r => esc(firstName(r.u))).join(', ') + (lagging.length > 3 ? ' ...' : '');
  const verdict = !tot.T ? T('The page post link is missing, so moderators cannot share yet.')
    : allDone ? (tot.P ? T('Everyone has shared. {n} links still need a check.', { n: tot.P }) : T('Everyone has shared and everything is verified. Great job!'))
    : Tn(lagging.length, '{n} person has not finished yet: {names}', '{n} people have not finished yet: {names}', { names });
  const r = 44, c = 2 * Math.PI * r;
  const ring = `<div class="th-ring"><svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true"><circle cx="58" cy="58" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="11"/><circle cx="58" cy="58" r="${r}" fill="none" stroke="${allDone ? '#34D399' : '#fff'}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - (tot.T ? tot.S / tot.T : 0))}"/></svg><b>${p100}%</b><small>${T('shared')}</small></div>`;
  const chip = (v, l, cls = '') => `<div class="th-chip ${cls}"><b>${v}</b><span>${l}</span></div>`;
  const hero = `<div class="today-hero ${allDone ? 'is-done' : ''}">
    ${ring}
    <div class="th-main">${kicker}<h2>${allDone ? T('All shares complete') : T('{d} of {t} people have shared everything', { d: doneP, t: withTask.length })}</h2><p>${verdict}</p>
      <div class="th-chips">${chip(`${tot.S}/${tot.T}`, T('tasks with a link'))}${chip(tot.T - tot.S, T('still left'), tot.T - tot.S ? 'bad' : '')}${chip(tot.P, T('to check'), tot.P ? 'warn' : '')}${chip(tot.V, T('verified'), 'ok')}${tot.R ? chip(tot.R, T('rejected'), 'bad') : ''}${tot.L ? chip(tot.L, T('late'), 'warn') : ''}</div></div>
    <div class="th-side">${lagging.length ? `<button class="btn" data-action="copy-lagging">${icon('copy', 15)} ${T('Copy reminder list')}</button>` : ''}<button class="btn th-ghost" data-action="nav" data-page="verify">${icon('checkCircle', 15)} ${T('Check queue')}${tot.P ? ` (${tot.P})` : ''}</button></div>
  </div>`;
  const postStrip = `<div class="today-posts">${posts.map(p => { const tr = taskRows(p).filter(x => x.assigned), sent = tr.filter(x => x.share).length; return `<button class="tp" data-action="open-post" data-id="${p.id}">${postThumb(p)}<span class="tp-t"><b>${esc(p.title)}</b><small>${p.time ? fmtTime(p.time) : ''}${canShare(p) ? ' . ' + T('{s}/{t} sent', { s: sent, t: tr.length }) : ' . ' + T('no link')}</small></span><span class="tp-bar"><i style="width:${pct(sent, tr.length)}%"></i></span></button>`; }).join('')}</div>`;
  const cards = rows.map(x => {
    const pills = x.list.length ? x.list.map(r => { const k = r.share ? r.share.status : (canShare(r.p) ? 'none' : 'sched'); return `<button class="tpill m-${k}" data-action="open-post" data-id="${r.p.id}" title="${esc(r.p.title + ' . ' + targetName(r.groupId) + ': ' + (r.share ? stLabel(r.share.status) : T('Not shared')))}">${icon({ verified: 'check', pending: 'clock', rejected: 'x', none: 'alert', sched: 'clock' }[k], 11)}<span>${posts.length > 1 ? esc(r.p.title.split(' ').slice(0, 2).join(' ')) + ' . ' : ''}${esc(shortTarget(r.groupId))}</span></button>`; }).join('') : `<span class="muted small">${T('No task on this day')}</span>`;
    return `<div class="tm tm-${x.tone}"><div class="tm-top clickable" data-action="view-mod" data-id="${x.u.id}" title="${T('See full activity')}"><span class="tm-av">${avatar(x.u, 40)}</span><div class="tm-name"><b>${esc(x.u.name)}</b><span class="tm-st">${x.st}</span></div><span class="tm-num">${x.tasks.length ? `${x.sent}<small>/${x.tasks.length}</small>` : '-'}</span></div>
      <div class="tm-bar"><i style="width:${pct(x.sent, x.tasks.length)}%"></i></div>
      <div class="tm-pills">${pills}${x.miss || x.rej ? `<button class="tpill wa-pill" data-action="remind" data-id="${x.u.id}" data-day="${day}" title="${T(x.u.phone ? 'Send a WhatsApp reminder' : 'Copy a reminder message')}">${icon('chat', 11)}<span>${T('Remind')}</span></button>` : ''}</div></div>`;
  }).join('');
  return `<div class="today-wrap"><div class="day-bar">${nav}</div>${hero}${postStrip}<div class="today-grid">${cards}</div></div>`;
}

/* ---------------- post timeline (tomorrow, today, then past dates) ---------------- */
function timelineHTML() {
  const tdy = todayYmd(), tmr = addDays(tdy, 1), days = App.tlDays || 7, from = addDays(tdy, -days);
  const by = {}; State.db.posts.filter(p => p.date <= tmr && p.date > from).forEach(p => (by[p.date] = by[p.date] || []).push(p));
  [tmr, tdy].forEach(d => { by[d] = by[d] || []; });
  const older = State.db.posts.some(p => p.date <= from);
  const html = Object.keys(by).sort().reverse().map(d => {
    const list = by[d].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    const rel = [tmr, tdy, addDays(tdy, -1)].includes(d);
    const head = `<div class="tl-head ${d === tdy ? 'today' : ''}">${dayLabel(d)} <em>${Tn(list.length, '{n} post', '{n} posts')}</em>${rel ? `<small>${fmtDay(d)}</small>` : ''}</div>`;
    const rows = list.length ? list.map(p => {
      const tr = taskRows(p).filter(r => r.assigned), done = tr.filter(r => r.share).length, pend = tr.filter(r => r.share && r.share.status === 'pending').length;
      return `<div class="tl-row" data-action="open-post" data-id="${p.id}" tabindex="0" role="button"><span class="time">${p.time ? fmtTime(p.time) : '--'}</span>${postThumb(p)}<div class="grow"><b>${esc(p.title)}</b><small>${T(p.tag || 'Other')} . ${Tn(tr.length, '{n} task', '{n} tasks')}${p.groupShare ? ' . ' + T('group share') : ''}</small></div>${!isLive(p) ? `<span class="badge b-sched">${T('Scheduled')}</span>` : !p.fbLink ? `<span class="badge b-none">${T('No link')}</span>` : `<span class="badge ${pend ? 'b-pending' : done === tr.length && tr.length ? 'b-verified' : 'b-none'}">${T('{s}/{t} sent', { s: done, t: tr.length })}${pend ? ', ' + T('{n} to review', { n: pend }) : ''}</span>`}</div>`;
    }).join('') : `<div class="tl-empty">${T('No posts')} <button class="btn sm" data-action="new-post" data-date="${d}">${icon('plus', 13)} ${T('Add')}</button></div>`;
    return `<div class="tl-day">${head}${rows}</div>`;
  }).join('');
  return `<div class="tl-scroll">${html}${older ? `<div class="tl-empty" style="justify-content:center"><button class="btn sm" data-action="tl-more">${T('Show 7 more days')}</button></div>` : ''}</div>`;
}

/* ---------------- single moderator activity page ---------------- */
function memberRows(id) {
  const rows = [];
  monthPosts().filter(canShare).forEach(p => taskRows(p).forEach(r => { if (r.userId === id && (r.assigned || r.share)) rows.push({ ...r, p }); }));
  return rows.sort((a, b) => (b.p.date + (b.p.time || '')).localeCompare(a.p.date + (a.p.time || '')) || (a.groupId ? 1 : 0) - (b.groupId ? 1 : 0));
}
function memberFiltered(id) {
  const w = App.dWhere || '', st = App.dStatus || '';
  return memberRows(id).filter(r => (!w || (w === 'profile' ? !r.groupId : w === 'group' ? !!r.groupId : r.groupId === w)) && (!st || (st === 'none' ? !r.share : r.share && r.share.status === st)));
}
const checkedLine = s => { if (!s || !s.checkedAt) return ''; const c = userById(s.checkedBy); return T(s.status === 'verified' ? 'Checked {t}' : 'Marked {t}', { t: timeAgo(s.checkedAt) }) + (c ? ' ' + T('by {name}', { name: esc(firstName(c)) }) : ''); };
function memberPage() {
  const u = userById(App.detailId);
  if (!u) return `<div class="card">${emptyHTML('user', T('Moderator not found'))}</div>`;
  const st = statsFor(u.id), all = memberRows(u.id), miss = all.filter(r => r.assigned && !r.share).length;
  const t = todayYmd(), today = State.db.posts.filter(p => p.date === t).sort(byDateTime).flatMap(p => taskRows(p).filter(r => r.userId === u.id && (r.assigned || r.share)).map(r => ({ ...r, p })));
  const head = `<div class="card member-head">
    <button class="btn sm ghost" data-action="nav" data-page="moderators">${icon('chevL', 14)} ${T('Moderators')}</button>
    <div class="mh-main">${avatar(u, 72)}<div class="mh-info"><h2>${esc(u.name)} ${u.active ? `<span class="badge b-verified">${T('Active')}</span>` : `<span class="badge b-off">${T('Inactive')}</span>`}</h2>
      <div class="mh-meta"><span>@${esc(u.username)}</span>${u.email ? `<span>${esc(u.email)}</span>` : ''}${u.phone ? `<span>${esc(u.phone)}</span>` : ''}${u.fb ? `<a href="${esc(u.fb)}" target="_blank" rel="noopener">${icon('fb', 13)} ${T('Facebook profile')}</a>` : ''}<span>${T('Last login')}: ${u.lastLogin ? timeAgo(u.lastLogin) : T('Never')}</span></div></div>
      <div class="mh-acts"><button class="btn sm wa-btn" data-action="remind" data-id="${u.id}" data-day="${todayYmd()}">${icon('chat', 14)} ${T('Remind')}</button><button class="btn sm" data-action="edit-mod" data-id="${u.id}">${icon('edit', 14)} ${T('Edit')}</button></div></div></div>`;
  const kp = `<div class="grid kpis">
    ${kpi(T('Assigned tasks'), st.expected, monthLabel(App.month), 'target', 'accent')}
    ${kpi(T('Links submitted'), st.total, T('{p} profile, {g} group', { p: st.profile, g: st.group }), 'share', 'fb')}
    ${kpi(T('Verified'), st.verified, T('{n}% completion', { n: pct(st.verified, st.expected) }), 'checkCircle', 'success')}
    ${kpi(T('Pending check'), st.pending, T('Waiting for you to check'), 'clock', 'warn')}
    ${kpi(T('Missing / Rejected'), `${miss} / ${st.rejected}`, T('Not shared / not valid'), 'alert', 'danger')}
  </div>`;
  const todayBox = `<div class="card" style="margin-bottom:16px"><div class="card-h"><div><h3>${icon('calendar', 15)} ${T('Today\'s tasks')} . ${fmtDay(t)}</h3><p>${today.length ? T('Link submitted for {s} of {t}', { s: today.filter(r => r.share).length, t: today.filter(r => r.assigned).length }) : T('No tasks for today')}</p></div></div>
    ${today.length ? `<div class="today-list">${today.map(r => `<div class="tl-item">${statusBadge(r.share ? r.share.status : 'none')}<b>${esc(r.p.title)}</b>${targetBadge(r.groupId)}${!canShare(r.p) ? `<span class="muted small">${T('Post not ready yet')}</span>` : r.share ? `<a class="lnk" href="${esc(r.share.link)}" target="_blank" rel="noopener">${icon('ext', 13)}<span>${esc(shortUrl(r.share.link))}</span></a>` : `<span class="muted small">${T('Not shared yet')}</span>`}</div>`).join('')}</div>` : ''}</div>`;
  const list = memberFiltered(u.id), links = list.filter(r => r.share);
  [...App.dsel].forEach(id => { if (!links.some(r => r.share.id === id)) App.dsel.delete(id); });
  const n = App.dsel.size, wf = App.dWhere || '', sf = App.dStatus || '';
  const cnt = k => all.filter(r => k === 'profile' ? !r.groupId : k === 'group' ? !!r.groupId : true).length;
  const toolbar = `<div class="card-h act-bar">
    <div class="tabs"><button class="tab ${!wf ? 'active' : ''}" data-action="set" data-key="dWhere" data-val="">${T('All')}<em>${cnt('')}</em></button><button class="tab ${wf === 'profile' ? 'active' : ''}" data-action="set" data-key="dWhere" data-val="profile">${icon('user', 13)} ${T('Profile')}<em>${cnt('profile')}</em></button><button class="tab ${wf === 'group' || groupById(wf) ? 'active' : ''}" data-action="set" data-key="dWhere" data-val="group">${icon('users', 13)} ${T('Group')}<em>${cnt('group')}</em></button></div>
    ${State.db.groups.length ? `<select class="input" data-filter="dWhere" aria-label="${T('Group filter')}"><option value="">${T('Everywhere')}</option><option value="profile" ${wf === 'profile' ? 'selected' : ''}>${T('Profile only')}</option><option value="group" ${wf === 'group' ? 'selected' : ''}>${T('All groups')}</option>${State.db.groups.map(g => `<option value="${g.id}" ${wf === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>` : ''}
    <select class="input" data-filter="dStatus" aria-label="${T('Status filter')}"><option value="">${T('All statuses')}</option><option value="verified" ${sf === 'verified' ? 'selected' : ''}>${T('Verified')}</option><option value="pending" ${sf === 'pending' ? 'selected' : ''}>${T('Pending')}</option><option value="rejected" ${sf === 'rejected' ? 'selected' : ''}>${T('Rejected')}</option><option value="none" ${sf === 'none' ? 'selected' : ''}>${T('Not shared')}</option></select>
    <span class="spacer"></span>
    <button class="btn sm" data-action="open-links" data-mode="all" ${links.length ? '' : 'disabled'}>${icon('ext', 14)} ${T('Open all links ({n})', { n: links.length })}</button>
    <button class="btn sm primary" data-action="open-links" data-mode="sel" ${n ? '' : 'disabled'}>${icon('ext', 14)} ${T('Open selected ({n})', { n })}</button>
  </div>
  <div class="bulk-bar ${n ? '' : 'hide'}"><b>${T('{n} selected', { n })}</b><span class="muted small">${T('Open the links, check them, then mark:')}</span><button class="btn sm success" data-action="mark-links" data-s="verified">${icon('check', 14)} ${T('Still there (verified)')}</button><button class="btn sm danger" data-action="mark-links" data-s="removed">${icon('trash', 14)} ${T('Deleted by moderator')}</button><button class="btn sm ghost" data-action="clear-dsel">${T('Clear')}</button></div>`;
  const rowHTML = r => { const s = r.share, p = r.p, d = parseYmd(p.date); return `<tr class="${!s ? 'row-miss' : ''}">
      <td>${s ? `<input type="checkbox" data-dsel="${s.id}" ${App.dsel.has(s.id) ? 'checked' : ''} aria-label="${T('Select')}">` : ''}</td>
      <td><b>${d.getDate()} ${MON[d.getMonth()]}</b><br><small class="muted">${DOW[d.getDay()]}${p.time ? ', ' + fmtTime(p.time) : ''}</small></td>
      <td><div class="cell-post clickable" data-action="open-post" data-id="${p.id}">${postThumb(p)}<div><b>${esc(p.title)}</b><small>${r.assigned ? '' : T('No longer assigned')}</small></div></div></td>
      <td>${targetBadge(r.groupId)}</td>
      <td>${s ? `<a class="lnk" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('ext', 14)}<span>${esc(shortUrl(s.link))}</span></a><br><small class="muted">${fmtDT(s.submittedAt)}</small>${lateBadge(s)}` : `<span class="muted small">${T('No link submitted')}</span>`}</td>
      <td>${statusBadge(s ? s.status : 'none')}${s ? `<br><small class="muted">${checkedLine(s)}</small>` : ''}${s && s.note ? `<br><small class="muted" title="${esc(noteText(s.note))}">${esc(noteText(s.note).slice(0, 32))}${noteText(s.note).length > 32 ? '...' : ''}</small>` : ''}</td>
      <td><div class="acts">${s ? `<button class="icon-btn sm ok" data-action="verify" data-id="${s.id}" data-s="verified" title="${T(s.status === 'verified' ? 'Checked again, still there' : 'Verify')}" aria-label="${T('Verify')}">${icon('check', 15)}</button><button class="icon-btn sm bad" data-action="mark-one-removed" data-id="${s.id}" title="${T('Deleted by moderator')}" aria-label="${T('Mark as deleted')}">${icon('trash', 15)}</button><button class="icon-btn sm" data-action="edit-share" data-id="${s.id}" title="${T('Edit')}" aria-label="${T('Edit')}">${icon('edit', 15)}</button>` : ''}</div></td></tr>`; };
  const allSel = links.length && links.every(r => App.dsel.has(r.share.id));
  const table = list.length ? `<div class="table-wrap"><table class="tbl member-tbl"><thead><tr><th><input type="checkbox" data-dsel-all ${allSel ? 'checked' : ''} aria-label="${T('Select all')}"></th><th>${T('Date')}</th><th>${T('Post')}</th><th>${T('Where')}</th><th>${T('Shared link')}</th><th>${T('Status')}</th><th class="num">${T('Check')}</th></tr></thead><tbody>${list.map(rowHTML).join('')}</tbody></table></div>` : emptyHTML('share', T('Nothing matches this filter'));
  return `${head}${kp}${todayBox}<div class="card"><div class="card-h" style="border-bottom:0;padding-bottom:0"><div><h3>${T('Activity, {m}', { m: monthLabel(App.month) })}</h3><p>${T('Every task and link. Open the links in tabs to see if the posts are still there, then mark them.')}</p></div></div>${toolbar}${table}</div>
    <p class="muted small" style="margin-top:10px">${icon('alert', 12)} ${T('When opening many tabs, the browser may show "Pop-ups blocked" the first time. Click the icon at the right of the address bar and choose "Always allow".')}</p>`;
}
function openLinks(urls) {
  urls.forEach(u => window.open(u, '_blank', 'noopener'));
  toast(T('Opening {n} links. If some do not open, allow pop-ups in your browser.', { n: urls.length }));
}

/* ---------------- activity log ---------------- */
const LOG_TYPES = { post: ['Posts', 'file'], share: ['Shares', 'share'], verify: ['Checks', 'checkCircle'], user: ['People', 'users'], group: ['Groups', 'grid'], login: ['Logins', 'logout'], system: ['System', 'sliders'] };
function logText(e) {
  const by = userById(e.by), vars = {};
  Object.entries(e.vars || {}).forEach(([k, v]) => { vars[k] = `<b>${esc(k === 'where' && v === 'Profile' ? T('Profile') : (k === 'status' || k === 'role') ? T(v) : v)}</b>`; });
  vars.by = `<b>${esc(by ? by.name : T('Someone'))}</b>`;
  return T(e.text, vars);
}
function activityPage() {
  const q = App.q.trim().toLowerCase(), ty = App.logType || '';
  const all = State.db.log || [];
  const list = all.filter(e => (!ty || e.type === ty) && (!q || (logText(e).replace(/<[^>]+>/g, '') + ' ' + ((userById(e.by) || {}).name || '')).toLowerCase().includes(q))).slice(0, 300);
  const tabs = `<div class="tabs"><button class="tab ${!ty ? 'active' : ''}" data-action="set" data-key="logType" data-val="">${T('All')}<em>${all.length}</em></button>${Object.entries(LOG_TYPES).map(([k, [l, ic]]) => `<button class="tab ${ty === k ? 'active' : ''}" data-action="set" data-key="logType" data-val="${k}">${icon(ic, 13)} ${T(l)}</button>`).join('')}</div>`;
  if (!list.length) return `<div class="toolbar">${tabs}</div><div class="card">${emptyHTML('history', T('No activity yet'), T('Actions like adding posts, submitting links and verifying will show up here.'))}</div>`;
  let lastDay = '';
  const rows = list.map(e => { const d = todayYmd(new Date(e.at)), by = userById(e.by); const head = d !== lastDay ? `<div class="log-day">${dayLabel(d)}${[todayYmd(), addDays(todayYmd(), -1)].includes(d) ? ', ' + fmtDay(d) : ''}</div>` : ''; lastDay = d; const [, ic] = LOG_TYPES[e.type] || LOG_TYPES.system; return `${head}<div class="log-row"><span class="log-ic t-${e.type}">${icon(ic, 15)}</span>${avatar(by, 28)}<div class="grow">${logText(e)}</div><small class="muted" title="${fmtDT(e.at)}">${fmtDT(e.at)}</small></div>`; }).join('');
  return `<div class="toolbar">${tabs}</div><div class="card log-card">${rows}</div>${all.length > 300 ? `<p class="muted small">${T('Showing the latest 300 entries.')}</p>` : ''}`;
}

/* ---------------- chart ---------------- */
function chartHTML() {
  const md = App.month, y = md.getFullYear(), m = md.getMonth(), dim = new Date(y, m + 1, 0).getDate(), t = todayYmd();
  const by = {}; monthPosts().forEach(p => (by[p.date] = by[p.date] || []).push(p.id));
  const data = []; let max = 1;
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`, ids = by[ds] || [];
    const ss = State.db.shares.filter(s => ids.includes(s.postId));
    const v = ss.filter(s => s.status === 'verified').length;
    data.push({ d, ds, total: ss.length, v, posts: ids.length }); max = Math.max(max, ss.length);
  }
  const cols = data.map(x => `<div class="col ${x.ds === t ? 'today' : ''}" data-tip="${esc(T('{d}: {p} posts, {s} shares, {v} verified', { d: `${x.d} ${MON[m]}`, p: x.posts, s: x.total, v: x.v }))}"><div class="stack" style="height:${x.total / max * 100}%"><i class="seg-v" style="flex:${x.v}"></i><i class="seg-o" style="flex:${x.total - x.v}"></i></div><span class="x">${x.d === 1 || x.d % 5 === 0 || x.ds === t ? x.d : ''}</span></div>`).join('');
  return `<div class="chart" role="img" aria-label="${T('Daily shares chart')}">${cols}</div>`;
}

/* ---------------- post modal ---------------- */
function openPost(id) {
  const p = postById(id); if (!p) return;
  const ss = sharesOfPost(p.id), pend = ss.filter(s => s.status === 'pending');
  const extra = `<button class="btn sm" data-action="edit-post" data-id="${p.id}">${icon('edit', 14)} ${T('Edit')}</button><button class="btn sm" data-action="dup-post" data-id="${p.id}">${icon('dup', 14)} ${T('Duplicate')}</button><button class="btn sm danger-t" data-action="delete-post" data-id="${p.id}">${icon('trash', 14)} ${T('Delete')}</button>`;
  const tr = taskRows(p).filter(r => r.assigned);
  const summary = `<div class="sec-title">${T('Share tasks')} <span class="muted">(${T('{s}/{t} submitted . {v} verified', { s: tr.filter(r => r.share).length, t: tr.length, v: ss.filter(s => s.status === 'verified').length })})</span><span class="spacer"></span>${pend.length ? `<button class="btn sm success" data-action="verify-post-all" data-id="${p.id}">${icon('check', 14)} ${T('Verify all pending ({n})', { n: pend.length })}</button>` : ''}</div>`;
  openModal({ title: T('Post details'), sub: T('Open the shared links and check them'), size: 'lg',
    body: `<div class="post-view"><div>${postMedia(p)}</div><div>${postInfo(p, extra)}<div class="added-line">${icon('clock', 13)} ${addedLine(p)}</div></div></div>${summary}${isLive(p) ? '' : `<div class="note">${icon('clock', 16)}<span>${T('This post goes live on {d}. Moderators can share it then. The assigned tasks are listed below.', { d: fmtDay(p.date) })}</span></div>`}${shareRows(p, 'admin')}` });
  App.modalPost = p.id;
}

/* ---------------- forms: post ---------------- */
const nowHM = () => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
function addedLine(p) {
  const by = userById(p.createdBy), up = p.updatedAt ? userById(p.updatedBy) : null;
  return T('Added to dashboard: {t}', { t: `<b>${p.createdAt ? fmtDT(p.createdAt) : '-'}</b>` }) + (by ? ' ' + T('by {name}', { name: esc(by.name) }) : '') + (p.updatedAt ? ' . ' + T('Last edit: {t}', { t: fmtDT(p.updatedAt) }) + (up ? ' ' + T('by {name}', { name: esc(up.name) }) : '') : '');
}
document.addEventListener('paste', e => {
  if (!$('#pf')) return;
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  readImage(item.getAsFile(), url => { $('#imgVal').value = url; $('#imgPrev').innerHTML = `<img src="${url}" alt="">`; toast(T('Image pasted')); });
});
const imgDropEmpty = () => `${icon('image', 28)}<span>${T('Upload image')}</span><small>${T('Or paste a screenshot with Ctrl+V')}</small>`;
function postForm(p = {}, presetDate) {
  const isNew = !p.id;
  const last = State.db.posts.filter(x => x.id !== p.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  openModal({ title: T(isNew ? 'New post' : 'Edit post'), sub: T('After posting on the page, paste the link here so moderators can see it'), size: 'lg',
    body: `<form id="pf" data-form="post"><input type="hidden" name="id" value="${p.id || ''}"><input type="hidden" name="image" id="imgVal" value="${esc(p.image || '')}">
    <div class="note" style="margin-bottom:14px">${icon('clock', 16)}<span>${isNew ? T('The time you add this post is saved automatically with your name ({t}). The time field below is filled with the current time, change it if needed.', { t: fmtDT(new Date().toISOString()) }) : addedLine(p)}</span></div>
    <div class="pf-grid"><div>
      <label class="field"><span>${T('Title')} *</span><input name="title" value="${esc(p.title || '')}" required maxlength="120" placeholder="${T('e.g. Admission Open 2026')}"></label>
      <div class="row2"><label class="field"><span>${T('Date')} *</span><input type="date" name="date" value="${p.date || presetDate || todayYmd()}" required></label><label class="field"><span>${T('Time posted on the page')}</span><input type="time" name="time" value="${p.time || nowHM()}"></label></div>
      <div class="row2"><label class="field"><span>${T('Type')}</span><select name="tag">${Object.keys(TAGS).map(k => `<option value="${k}" ${p.tag === k ? 'selected' : ''}>${T(k)}</option>`).join('')}</select></label>
      <label class="field"><span>${T('Facebook page post link')}</span><input type="url" name="fbLink" value="${esc(p.fbLink || '')}" placeholder="https://www.facebook.com/..."></label></div>
      <label class="field"><span>${T('Caption')}</span><textarea name="caption" placeholder="${T('Moderators can copy this')}">${esc(p.caption || '')}</textarea><small>${T('Without a link the post stays "Scheduled" and moderators cannot submit shares.')}</small></label>
    </div><div>
      <span class="field" style="margin:0"><span>${T('Image')}</span></span>
      <label class="img-drop" for="imgFile" id="imgPrev">${p.image ? `<img src="${esc(p.image)}" alt="">` : imgDropEmpty()}</label>
      <input type="file" id="imgFile" accept="image/*" hidden>
      <div class="post-btns"><label class="btn sm" for="imgFile">${icon('upload', 14)} ${T('Choose')}</label><button type="button" class="btn sm ghost" data-action="clear-img">${T('Remove')}</button></div>
      <label class="field" style="margin-top:12px"><span>${T('Or image URL')}</span><input name="imageUrl" type="url" placeholder="https://..."></label>
    </div></div>${assignFormHTML(p, last)}</form>`,
    foot: `${!isNew ? `<button class="btn ghost danger-t" data-action="delete-post" data-id="${p.id}">${icon('trash', 15)} ${T('Delete')}</button><span class="spacer"></span>` : ''}<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn primary" type="submit" form="pf">${T(isNew ? 'Create post' : 'Save changes')}</button>` });
}
Forms.post = (f, fd) => {
  const title = String(fd.get('title')).trim(), date = fd.get('date'), fbLink = cleanLink(fd.get('fbLink')), imageUrl = String(fd.get('imageUrl') || '').trim();
  if (!title || !date) { toast(T('Title and date are required'), 'error'); return; }
  if (fbLink && !isFbUrl(fbLink)) { toast(T('Enter a valid Facebook link (facebook.com)'), 'error'); return; }
  if (fbLink && !looksLikePost(fbLink)) { toast(T('That looks like a page or profile link. Open the post and copy its link.'), 'error'); return; }
  if (fbLink && State.db.posts.some(x => x.id !== fd.get('id') && x.fbLink && sameLink(x.fbLink, fbLink))) { toast(T('This page post link is already used by another post'), 'error'); return; }
  if (imageUrl && !isUrl(imageUrl)) { toast(T('The image URL is not valid'), 'error'); return; }
  const id = fd.get('id');
  const assign = fd.get('assign') || 'all', assignees = fd.getAll('assignees');
  if (assign === 'selected' && !assignees.length) { toast(T('Select at least one person for profile sharing'), 'error'); return; }
  const groupShare = !!fd.get('groupShare'), gu = fd.getAll('gtUser'), gg = fd.getAll('gtGroup'), seen = new Set(), groupTasks = [];
  if (groupShare && gu.some((u, i) => (u && !gg[i]) || (!u && gg[i]))) { toast(T('Pick both a moderator and a group in each group row'), 'error'); return; }
  gu.forEach((u, i) => { const g = gg[i]; if (!u || !g) return; const k = u + '|' + g; if (seen.has(k)) return; seen.add(k); groupTasks.push({ userId: u, groupId: g }); });
  if (groupShare && !groupTasks.length) { toast(T('Group sharing is on: pick at least one moderator and group'), 'error'); return; }
  const data = { title, date, time: fd.get('time') || '', tag: fd.get('tag') || 'Other', fbLink, caption: String(fd.get('caption') || '').trim(), image: imageUrl || fd.get('image') || '',
    assign, assignees: assign === 'selected' ? assignees : [], groupShare, groupTasks: groupShare ? groupTasks : [] };
  if (id) { Object.assign(postById(id), data, { updatedAt: new Date().toISOString(), updatedBy: App.user.id }); logEvent('post', '{by} edited the post {post}', { post: title }); closeModal(); commit(T('Post updated')); openPost(id); }
  else { const p = { id: uid('p'), ...data, createdAt: new Date().toISOString(), createdBy: App.user.id }; State.db.posts.push(p); logEvent('post', '{by} added the post {post} for {date}', { post: title, date: fmtDate(date) }); App.month = firstOfMonth(parseYmd(date)); App.dayView = ''; closeModal(); commit(T('Post created')); }
};

/* ---------------- post form: share assignment ---------------- */
function gtRowHTML(t = {}) {
  const mods = activeMods(), groups = State.db.groups.filter(g => g.active || g.id === t.groupId);
  return `<div class="gt-row"><select class="input" name="gtUser" aria-label="${T('Moderator')}"><option value="">${T('Choose moderator...')}</option>${mods.map(u => `<option value="${u.id}" ${t.userId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    <span class="gt-arrow">${icon('chevR', 16)}</span>
    <select class="input" name="gtGroup" aria-label="${T('Group')}"><option value="">${T('Choose group...')}</option>${groups.map(g => `<option value="${g.id}" ${t.groupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
    <button type="button" class="icon-btn sm bad" data-action="gt-remove" aria-label="${T('Remove row')}">${icon('x', 14)}</button></div>`;
}
function assignFormHTML(p, last) {
  const assign = p.assign || 'all', sel = new Set(p.assignees || []), gs = !!p.groupShare, mods = activeMods();
  const rows = (p.groupTasks && p.groupTasks.length ? p.groupTasks : [{}]).map(gtRowHTML).join('');
  const seg = [['all', 'All moderators'], ['selected', 'Pick people'], ['none', 'Not needed']].map(([v, l]) => `<label><input type="radio" name="assign" value="${v}" ${assign === v ? 'checked' : ''}><span>${T(l)}</span></label>`).join('');
  return `<div class="assign-box">
    <div class="assign-h">${icon('share', 16)} ${T('Share assignment')} <small class="muted">${T('Who shares this post, and where')}</small><span class="spacer"></span>${last ? `<button type="button" class="btn sm" data-action="copy-assign" data-id="${last.id}" title="${esc(last.title)}">${icon('copy', 13)} ${T('Same as last post')}</button>` : ''}</div>
    <div class="field"><span>${T('1. Share on their own profile')}</span><div class="seg">${seg}</div></div>
    <div class="mod-picks" id="modPicks" ${assign === 'selected' ? '' : 'hidden'}>${mods.length ? mods.map(u => `<label class="pick"><input type="checkbox" name="assignees" value="${u.id}" ${sel.has(u.id) ? 'checked' : ''}>${avatar(u, 24)}<span>${esc(u.name)}</span></label>`).join('') : `<span class="muted small">${T('No active moderators')}</span>`}</div>
    <div class="field" style="margin-top:14px"><span>${T('2. Share in groups')}</span><label class="switch"><input type="checkbox" name="groupShare" id="gsToggle" ${gs ? 'checked' : ''}> ${T('This post must be shared in groups')}</label></div>
    <div id="gtWrap" ${gs ? '' : 'hidden'}>
      ${State.db.groups.some(g => g.active) ? `<p class="muted small" style="margin:0 0 8px">${T('Each row = one moderator shares in one group. Add more rows to give someone several groups.')}</p><div id="gtRows">${rows}</div>
      <div class="post-btns" style="margin-top:8px"><button type="button" class="btn sm" data-action="gt-add">${icon('plus', 14)} ${T('Add row')}</button><button type="button" class="btn sm ghost" data-action="gt-fill">${T('Give the chosen group to everyone')}</button></div>`
      : `<div class="note warn">${icon('alert', 16)}<span>${T('No groups added yet. Add groups on the "FB Groups" page first.')}</span></div>`}
    </div></div>`;
}

/* ---------------- forms: group ---------------- */
function groupForm(g = {}) {
  const isNew = !g.id;
  openModal({ title: T(isNew ? 'Add Facebook group' : 'Edit group'), sub: T('Moderators will share posts in this group'),
    body: `<form id="gf" data-form="group"><input type="hidden" name="id" value="${g.id || ''}">
      <label class="field"><span>${T('Group name')} *</span><input name="name" value="${esc(g.name || '')}" required maxlength="80" placeholder="${T('e.g. Dhaka Job Seekers Hub')}"></label>
      <label class="field"><span>${T('Group link')} *</span><input name="url" type="url" value="${esc(g.url || '')}" required placeholder="https://www.facebook.com/groups/..."></label>
      <label class="field"><span>${T('Note')}</span><input name="note" value="${esc(g.note || '')}" placeholder="${T('e.g. Posts need approval, 50k members')}"></label>
      <label class="switch"><input type="checkbox" name="active" ${g.active !== false ? 'checked' : ''}> ${T('Active (shown when assigning posts)')}</label>
    </form>`,
    foot: `<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn primary" type="submit" form="gf">${T(isNew ? 'Add group' : 'Save')}</button>` });
}
Forms.group = (f, fd) => {
  const id = fd.get('id'), name = String(fd.get('name')).trim(), url = cleanLink(fd.get('url'));
  if (!name) { toast(T('Enter the group name'), 'error'); return; }
  if (!isFbUrl(url)) { toast(T('Enter a valid Facebook group link'), 'error'); return; }
  if (State.db.groups.some(g => g.id !== id && g.url.replace(/\/+$/, '').toLowerCase() === url.replace(/\/+$/, '').toLowerCase())) { toast(T('This group is already added'), 'error'); return; }
  const data = { name, url, note: String(fd.get('note') || '').trim(), active: !!fd.get('active') };
  if (id) { Object.assign(groupById(id), data); logEvent('group', '{by} edited the group {group}', { group: name }); closeModal(); commit(T('Group updated')); }
  else { State.db.groups.push({ id: uid('g'), ...data, createdAt: new Date().toISOString() }); logEvent('group', '{by} added the group {group}', { group: name }); closeModal(); commit(T('{name} added', { name })); }
};

/* ---------------- forms: moderator / admin ---------------- */
function userForm(u = {}, role = 'moderator') {
  const isNew = !u.id, r = u.role || role, isMod = r === 'moderator', color = u.color || COLORS[State.db.users.length % COLORS.length];
  openModal({ title: T(isMod ? (isNew ? 'Add moderator' : 'Edit moderator') : (isNew ? 'Add admin' : 'Edit admin')), sub: isNew ? T('They log in with their username or email and password') : '@' + esc(u.username),
    body: `<form id="uf" data-form="user"><input type="hidden" name="id" value="${u.id || ''}">
      ${photoInput(u.id)}
      <label class="field"><span>${T('Full name')} *</span><input name="name" value="${esc(u.name || '')}" required></label>
      <div class="row2"><label class="field"><span>${T('Username')} *</span><input name="username" value="${esc(u.username || '')}" required pattern="[A-Za-z0-9_.]{3,30}" title="${T('3 to 30 letters, numbers, _ or .')}" autocomplete="off"></label>
      <label class="field"><span>${T('Email')}</span><input name="email" type="email" ${MODE === 'cloud' ? 'required' : ''} value="${esc(u.email || '')}" placeholder="name@example.com" autocomplete="off"></label></div>
      <div class="row2"><label class="field"><span>${T('Password')} ${isNew ? '*' : ''}</span><input name="password" type="password" ${isNew ? 'required' : ''} minlength="${MIN_PW}" placeholder="${isNew ? T('At least {n} characters', { n: MIN_PW }) : T('Leave blank to keep it')}" autocomplete="off"></label>
      ${isMod ? `<input type="hidden" name="role" value="moderator"><label class="field"><span>${T('WhatsApp number')}</span><input name="phone" type="tel" value="${esc(u.phone || '')}" placeholder="01XXXXXXXXX"><small>${T('For one-click reminders')}</small></label></div><div class="row2"><label class="field"><span>${T('Facebook profile link')}</span><input name="fb" type="url" value="${esc(u.fb || '')}" placeholder="https://www.facebook.com/..."></label><span></span>`
        : `<label class="field"><span>${T('Role')}</span><select name="role"><option value="admin" ${r === 'admin' ? 'selected' : ''}>${T('Admin (posts, verification, moderators)')}</option><option value="superadmin" ${r === 'superadmin' ? 'selected' : ''}>${T('Super Admin (everything + manage admins)')}</option></select></label>`}</div>
      <div class="field"><span>${T('Color')}</span><div class="swatches">${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="${c}"><i style="--c:${c}"></i></label>`).join('')}</div></div>
      <label class="switch"><input type="checkbox" name="active" ${u.active !== false ? 'checked' : ''}> ${T('Active (can log in)')}</label>
    </form>`,
    foot: `<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn primary" type="submit" form="uf">${T(isNew ? (isMod ? 'Add moderator' : 'Add admin') : 'Save')}</button>` });
}
const modForm = u => userForm(u, 'moderator');
const activeSupers = () => State.db.users.filter(u => u.role === 'superadmin' && u.active);
Forms.user = (f, fd) => {
  const id = fd.get('id'), name = String(fd.get('name')).trim(), username = String(fd.get('username')).trim(), email = String(fd.get('email') || '').trim(), pw = String(fd.get('password') || ''), fb = String(fd.get('fb') || '').trim();
  const role = fd.get('role') || 'moderator', active = !!fd.get('active'), old = id ? userById(id) : null;
  if (isAdminRole(role) && !isSuper()) { toast(T('Only a Super Admin can add or edit admins'), 'error'); return; }
  if (old && isAdminRole(old.role) && !isSuper()) { toast(T('Only a Super Admin can add or edit admins'), 'error'); return; }
  if (!name) { toast(T('Enter a name'), 'error'); return; }
  if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) { toast(T('3 to 30 letters, numbers, _ or .'), 'error'); return; }
  if (State.db.users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== id)) { toast(T('This username is already taken'), 'error'); return; }
  if (email && !isEmail(email)) { toast(T('That email is not valid'), 'error'); return; }
  if (email && State.db.users.some(u => u.id !== id && (u.email || '').toLowerCase() === email.toLowerCase())) { toast(T('This email is used by another account'), 'error'); return; }
  if (fb && !isFbUrl(fb)) { toast(T('Enter a valid Facebook profile link'), 'error'); return; }
  if ((!id && pw.length < MIN_PW) || (id && pw && pw.length < MIN_PW)) { toast(T('Password needs at least {n} characters', { n: MIN_PW }), 'error'); return; }
  const phone = String(fd.get('phone') || '').trim();
  if (phone && !waNumber(phone)) { toast(T('Enter a valid WhatsApp number'), 'error'); return; }
  if (old && old.id === App.user.id && (!active || role !== old.role)) { toast(T('You cannot change your own role or active status'), 'error'); return; }
  if (old && old.role === 'superadmin' && (role !== 'superadmin' || !active) && activeSupers().length <= 1) { toast(T('There must be at least one active Super Admin'), 'error'); return; }
  const data = { name, username, email, color: fd.get('color') || COLORS[0], active, role };
  if (role === 'moderator') { data.fb = fb ? cleanLink(fb) : ''; data.phone = phone; }
  const photo = fd.get('photo');
  if (old) { Object.assign(old, data); if (pw) setPassword(old, pw); if (photo) old.photo = photo; if (old.id === App.user.id) App.user = old; logEvent('user', '{by} edited {name}', { name }); closeModal(); commit(T('{name} updated', { name })); }
  else { const u = { id: uid('u'), ...data, createdAt: new Date().toISOString(), createdBy: App.user.id }; setPassword(u, pw); if (photo) u.photo = photo; State.db.users.push(u); logEvent('user', '{by} added {name} as {role}', { name, role: { superadmin: 'Super Admin', admin: 'Admin', moderator: 'Moderator' }[u.role] }); closeModal(); commit(T('{name} added', { name })); }
};

/* ---------------- forms: share (admin edit) ---------------- */
function shareForm(s, ret) {
  const u = userById(s.userId), p = postById(s.postId), c = userById(s.checkedBy);
  openModal({ title: T('Edit share'), sub: `${esc(u ? u.name : '')} . ${esc(p ? p.title : '')} . ${esc(targetName(s.groupId))}`,
    body: `<form id="sf" data-form="share"><input type="hidden" name="id" value="${s.id}"><input type="hidden" name="ret" value="${ret || ''}">
      <label class="field"><span>${T('Shared link')}</span><input name="link" type="url" value="${esc(s.link)}" required></label>
      <div class="post-btns" style="margin:-4px 0 14px"><a class="btn sm fb" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('ext', 14)} ${T('Open link to check')}</a></div>
      <label class="field"><span>${T('Status')}</span><select name="status">${['pending', 'verified', 'rejected'].map(k => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${stLabel(k)}</option>`).join('')}</select></label>
      <label class="field"><span>${T('Note (the moderator will see this)')}</span><textarea name="note" style="min-height:70px" placeholder="${T('e.g. Please make the post Public')}">${esc(s.note || '')}</textarea></label>
      <dl class="kv"><dt>${T('Submitted')}</dt><dd>${fmtDT(s.submittedAt)}</dd>${s.checkedAt ? `<dt>${T('Checked')}</dt><dd>${fmtDT(s.checkedAt)}${c ? ' . ' + esc(c.name) : ''}</dd>` : ''}</dl>
    </form>`,
    foot: `<button class="btn ghost danger-t" data-action="delete-share" data-id="${s.id}">${icon('trash', 15)} ${T('Delete')}</button><span class="spacer"></span><button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn primary" type="submit" form="sf">${T('Save')}</button>` });
}
const shareCtx = s => { const u = userById(s.userId), p = postById(s.postId); return { name: u ? u.name : '?', post: p ? p.title : '?', where: s.groupId ? targetName(s.groupId) : 'Profile' }; };
Forms.share = (f, fd) => {
  const s = State.db.shares.find(x => x.id === fd.get('id')); if (!s) return;
  const link = cleanLink(fd.get('link'));
  if (!isFbUrl(link)) { toast(T('Enter a valid Facebook link (facebook.com)'), 'error'); return; }
  if (State.db.shares.some(x => x.id !== s.id && sameLink(x.link, link))) { toast(T('This link was already used in another submission'), 'error'); return; }
  const st = fd.get('status');
  if (st !== s.status) { s.checkedAt = st === 'pending' ? null : new Date().toISOString(); s.checkedBy = st === 'pending' ? null : App.user.id; }
  s.link = link; s.status = st; s.note = String(fd.get('note') || '').trim();
  logEvent('verify', '{by} edited {name}\'s {where} share on {post} ({status})', { ...shareCtx(s), status: ST[st][0] });
  const ret = fd.get('ret'); closeModal(); commit(T('Share updated')); if (ret) openPost(ret);
};
Forms['page-settings'] = (f, fd) => { State.db.settings.pageName = String(fd.get('pageName')).trim(); State.db.settings.pageUrl = String(fd.get('pageUrl') || '').trim(); logEvent('system', '{by} updated the page settings'); commit(T('Saved')); };

/* ---------------- actions ---------------- */
function setStatus(s, st) { s.status = st; s.checkedAt = new Date().toISOString(); s.checkedBy = App.user.id; if (st === 'verified') s.note = ''; }
const REMOVED_NOTE = 'The post was deleted or removed. Please share again and submit a new link.';
Object.assign(Actions, {
  'new-post': el => postForm({}, el.dataset.date),
  'edit-post': el => postForm(postById(el.dataset.id)),
  'dup-post': el => { const p = postById(el.dataset.id); if (!p) return; const copy = { ...p, id: '', date: addDays(todayYmd(), 1), time: p.time, fbLink: '', createdAt: '', updatedAt: '' }; postForm(copy); toast(T('Copied. Set the date and page link, then save.')); },
  'copy-assign': el => {
    const p = postById(el.dataset.id); if (!p) return;
    const r = $(`#pf input[name=assign][value="${p.assign || 'all'}"]`); if (r) { r.checked = true; $('#modPicks').hidden = p.assign !== 'selected'; }
    $$('#pf input[name=assignees]').forEach(c => { c.checked = (p.assignees || []).includes(c.value); });
    const gs = $('#gsToggle'); if (gs) { gs.checked = !!p.groupShare; $('#gtWrap').hidden = !p.groupShare; }
    const rows = $('#gtRows'); if (rows) rows.innerHTML = ((p.groupTasks || []).length ? p.groupTasks : [{}]).map(gtRowHTML).join('');
    toast(T('Assignment copied from "{post}"', { post: p.title }));
  },
  'delete-post': el => { const p = postById(el.dataset.id); if (!p) return; const n = sharesOfPost(p.id).length; confirmBox(T('Delete post?'), T('"{post}" and its {n} share links will be deleted.', { post: esc(p.title), n }), () => { State.db.posts = State.db.posts.filter(x => x.id !== p.id); State.db.shares = State.db.shares.filter(s => s.postId !== p.id); logEvent('post', '{by} deleted the post {post}', { post: p.title }); commit(T('Post deleted')); }, T('Delete')); },
  'clear-img': () => { $('#imgVal').value = ''; $('#imgPrev').innerHTML = imgDropEmpty(); const u = $('#pf [name=imageUrl]'); if (u) u.value = ''; },
  verify: el => {
    const s = State.db.shares.find(x => x.id === el.dataset.id); if (!s) return; const st = el.dataset.s;
    if (st === 'rejected') { rejectBox([s.id], App.modalPost); return; }
    const before = snap([s.id]); setStatus(s, st); logEvent('verify', '{by} verified {name}\'s {where} share on {post}', shareCtx(s)); commit(T('Verified'), 'success', undoAct(before));
  },
  'verify-post-all': el => { const list = sharesOfPost(el.dataset.id).filter(s => s.status === 'pending'), before = snap(list.map(s => s.id)); list.forEach(s => setStatus(s, 'verified')); const p = postById(el.dataset.id); logEvent('verify', '{by} verified {n} pending shares on {post}', { n: list.length, post: p ? p.title : '' }); commit(T('All pending shares verified'), 'success', undoAct(before)); },
  bulk: el => {
    const st = el.dataset.s, ids = [...App.sel], n = ids.length; if (!n) return;
    if (st === 'rejected') { rejectBox(ids); return; }
    const before = snap(ids); State.db.shares.filter(s => App.sel.has(s.id)).forEach(s => setStatus(s, st)); App.sel = new Set(); logEvent('verify', '{by} verified {n} shares at once', { n }); commit(T('{n} shares verified', { n }), 'success', undoAct(before));
  },
  'open-sel-links': () => { const list = State.db.shares.filter(s => App.sel.has(s.id)).map(s => s.link); if (!list.length) return; if (list.length > 15) confirmBox(T('Many tabs'), T('{n} new tabs will open. Continue?', { n: list.length }), () => openLinks(list), T('Open {n} tabs', { n: list.length }), false); else openLinks(list); },
  'edit-share': el => { const s = State.db.shares.find(x => x.id === el.dataset.id); if (s) shareForm(s, el.dataset.ret); },
  'delete-share': el => { const s = State.db.shares.find(x => x.id === el.dataset.id); if (!s) return; const ctx = shareCtx(s); confirmBox(T('Delete share?'), T('This share link from {name} will be deleted and their count will go down.', { name: esc(ctx.name) }), () => { State.db.shares = State.db.shares.filter(x => x.id !== s.id); logEvent('verify', '{by} deleted {name}\'s {where} share on {post}', ctx); commit(T('Share deleted')); }, T('Delete')); },
  'gt-add': () => { const w = $('#gtRows'); if (w) w.insertAdjacentHTML('beforeend', gtRowHTML()); },
  'gt-remove': el => { const rows = $$('#gtRows .gt-row'); if (rows.length > 1) el.closest('.gt-row').remove(); else { rows[0].querySelectorAll('select').forEach(x => x.value = ''); } },
  'gt-fill': () => {
    const rows = $$('#gtRows .gt-row'); const g = (rows.map(r => r.querySelector('[name=gtGroup]').value).find(Boolean)) || '';
    if (!g) { toast(T('Choose a group in one row first'), 'error'); return; }
    const have = new Set(rows.map(r => r.querySelector('[name=gtUser]').value + '|' + r.querySelector('[name=gtGroup]').value));
    rows.forEach(r => { if (!r.querySelector('[name=gtUser]').value) r.remove(); });
    let n = 0; activeMods().forEach(u => { if (!have.has(u.id + '|' + g)) { $('#gtRows').insertAdjacentHTML('beforeend', gtRowHTML({ userId: u.id, groupId: g })); n++; } });
    toast(Tn(n, '{n} row added', '{n} rows added'));
  },
  'new-group': () => groupForm(),
  'edit-group': el => groupForm(groupById(el.dataset.id)),
  'delete-group': el => {
    const g = groupById(el.dataset.id); if (!g) return;
    const n = State.db.shares.filter(s => s.groupId === g.id).length, t = State.db.posts.filter(p => (p.groupTasks || []).some(x => x.groupId === g.id)).length;
    confirmBox(T('Delete group?'), T('"{group}" will be deleted, along with the group tasks on {t} posts and {n} group share links. To just hide it, turn "Active" off.', { group: esc(g.name), t, n }), () => {
      State.db.groups = State.db.groups.filter(x => x.id !== g.id);
      State.db.shares = State.db.shares.filter(s => s.groupId !== g.id);
      State.db.posts.forEach(p => { if (p.groupTasks) { p.groupTasks = p.groupTasks.filter(x => x.groupId !== g.id); if (!p.groupTasks.length) p.groupShare = false; } });
      logEvent('group', '{by} deleted the group {group}', { group: g.name }); commit(T('Group deleted'));
    }, T('Delete'));
  },
  'tl-more': () => { App.tlDays = (App.tlDays || 7) + 7; renderPage(); },
  day: el => { const d = +el.dataset.d; App.dayView = d === 0 ? '' : addDays(App.dayView || todayYmd(), d); if (App.dayView === todayYmd()) App.dayView = ''; renderPage(); },
  'day-go': el => { App.dayView = el.dataset.day === todayYmd() ? '' : el.dataset.day; renderPage(); },
  'new-admin': () => isSuper() && userForm({}, 'admin'),
  'edit-admin': el => isSuper() && userForm(userById(el.dataset.id)),
  'delete-admin': el => {
    const u = userById(el.dataset.id); if (!u || !isSuper()) return;
    if (u.id === App.user.id) { toast(T('You cannot delete yourself'), 'error'); return; }
    if (u.role === 'superadmin' && activeSupers().filter(x => x.id !== u.id).length < 1) { toast(T('There must be at least one active Super Admin'), 'error'); return; }
    confirmBox(T('Remove admin?'), T('{name} will no longer be able to log in. Their posts and checks stay in the records.', { name: esc(u.name) }), () => { State.db.users = State.db.users.filter(x => x.id !== u.id); logEvent('user', '{by} removed the admin {name}', { name: u.name }); commit(T('Admin removed')); }, T('Remove'));
  },
  'copy-lagging': () => {
    const { day, rows } = dayData(App.dayView || todayYmd());
    const lines = rows.filter(r => r.tasks.length && (r.miss || r.rej)).map(r => `- ${r.u.name}: ` + r.tasks.filter(x => !x.share || x.share.status === 'rejected').map(x => `${x.p.title} (${targetName(x.groupId)}${x.share ? ', ' + T('rejected') : ''})`).join(', '));
    copyText(T('Shares still pending for {d}:', { d: fmtDay(day) }) + '\n' + lines.join('\n') + '\n' + T('Please log in to the dashboard, share the posts and submit your links.'), T('Reminder list copied'));
  },
  'view-mod': el => { App.detailId = el.dataset.id; App.dsel = new Set(); App.dWhere = ''; App.dStatus = ''; closeModal(); App.page = 'member'; try { history.pushState({ page: 'member', detail: App.detailId }, '', '#member'); } catch (e) {} render(); window.scrollTo(0, 0); },
  'clear-dsel': () => { App.dsel = new Set(); renderPage(); },
  'open-links': el => {
    const list = memberFiltered(App.detailId).filter(r => r.share && (el.dataset.mode === 'all' || App.dsel.has(r.share.id))).map(r => r.share.link);
    if (!list.length) return;
    if (list.length > 15) confirmBox(T('Many tabs'), T('{n} new tabs will open. Continue?', { n: list.length }), () => openLinks(list), T('Open {n} tabs', { n: list.length }), false);
    else openLinks(list);
  },
  'mark-links': el => {
    const ids = [...App.dsel], rm = el.dataset.s === 'removed', u = userById(App.detailId), before = snap(ids);
    State.db.shares.filter(s => ids.includes(s.id)).forEach(s => { setStatus(s, rm ? 'rejected' : 'verified'); if (rm) s.note = REMOVED_NOTE; });
    logEvent('verify', rm ? '{by} marked {n} of {name}\'s links as deleted' : '{by} re-checked {n} of {name}\'s links (still there)', { n: ids.length, name: u ? u.name : '' });
    App.dsel = new Set(); commit(T(rm ? '{n} links marked as deleted' : '{n} links verified', { n: ids.length }), rm ? 'error' : 'success', undoAct(before));
  },
  'mark-one-removed': el => { const s = State.db.shares.find(x => x.id === el.dataset.id); if (!s) return; const before = snap([s.id]); setStatus(s, 'rejected'); s.note = REMOVED_NOTE; logEvent('verify', '{by} marked {name}\'s {where} share on {post} as deleted', shareCtx(s)); commit(T('Marked as deleted'), 'error', undoAct(before)); },
  'new-mod': () => modForm(),
  'edit-mod': el => modForm(userById(el.dataset.id)),
  'delete-mod': el => { const u = userById(el.dataset.id); if (!u) return; const n = State.db.shares.filter(s => s.userId === u.id).length; confirmBox(T('Delete moderator?'), T('{name} and their {n} share records will be deleted. To just stop them logging in, turn "Active" off.', { name: esc(u.name), n }), () => { State.db.users = State.db.users.filter(x => x.id !== u.id); State.db.shares = State.db.shares.filter(s => s.userId !== u.id); State.db.posts.forEach(p => { p.assignees = (p.assignees || []).filter(x => x !== u.id); p.groupTasks = (p.groupTasks || []).filter(x => x.userId !== u.id); }); logEvent('user', '{by} deleted the moderator {name}', { name: u.name }); commit(T('Moderator deleted')); }, T('Delete')); },
  'export-json': () => { if (!isSuper()) return; State.db.settings.lastBackup = new Date().toISOString(); logEvent('system', '{by} downloaded a backup'); download(`ubei-sharehub-backup-${todayYmd()}.json`, JSON.stringify(State.db, null, 2), 'application/json'); commit(T('Backup is downloading')); },
  'reset-demo': () => isSuper() && confirmBox(T('Reset demo data?'), T('All data will be replaced with fresh demo data. Log in again with admin / admin123.'), () => { State.db = normalizeDB(seedDB()); saveDB(State.db); toast(T('Demo data reset')); logout(); }, T('Reset')),
  'start-fresh': () => isSuper() && confirmBox(T('Start fresh?'), T('All posts, moderators, groups and shares will be deleted. Only your account stays.'), () => { const a = userById(App.user.id); State.db = { version: 3, users: [a], groups: [], posts: [], shares: [], log: [], settings: { ...State.db.settings, demo: false, notice: null, lastBackup: '', hideSetup: false } }; logEvent('system', '{by} deleted all data and started fresh'); commit(T('Everything cleared. Now add your moderators.')); }, T('Delete everything')),
});

/* ---------------- undo ---------------- */
const snap = ids => State.db.shares.filter(s => ids.includes(s.id)).map(s => ({ id: s.id, status: s.status, checkedAt: s.checkedAt, checkedBy: s.checkedBy, note: s.note }));
function undoAct(before) {
  const expected = new Map(before.map(x => [x.id,(Cloud.recordVersion('shares',x.id)||0)+1]));
  return {label:T('Undo'),fn:()=>{
    if (MODE === 'cloud' && before.some(x=>Cloud.recordVersion('shares',x.id)!==expected.get(x.id))) { toast(T('This record changed. Refresh before undoing.'),'error'); return; }
    before.forEach(o=>{const s=State.db.shares.find(x=>x.id===o.id);if(s)Object.assign(s,o);});
    logEvent('verify','{by} undid the last check ({n} shares)',{n:before.length});return commit(T('Undone'));
  }};
}

/* ---------------- reject with a reason ---------------- */
/* reasons are saved in English and shown to each moderator in their own language */
const REASONS = [
  ['Not public', 'The post is not Public. Change it to Public and submit the link again.'],
  ['Link broken', 'The link does not open or is wrong. Copy the right link and submit again.'],
  ['Wrong post', 'This is not the post you were asked to share.'],
  ['Not in group', 'The post is not visible in the group yet (waiting for approval or removed).'],
  ['Deleted', REMOVED_NOTE],
];
function reasonChips(name, sel = 0) {
  return `<div class="reasons">${REASONS.map(([l, t], i) => `<label class="rchip"><input type="radio" name="${name}" value="${i}" ${i === sel ? 'checked' : ''}><span title="${esc(T(t))}">${T(l)}</span></label>`).join('')}</div>`;
}
function rejectBox(ids, ret) {
  const list = State.db.shares.filter(s => ids.includes(s.id)); if (!list.length) return;
  const one = list.length === 1 ? shareCtx(list[0]) : null;
  openModal({ title: T('Reject'), size: 'sm', sub: one ? `${esc(one.name)} . ${esc(one.post)} . ${esc(one.where === 'Profile' ? T('Profile') : one.where)}` : Tn(list.length, '{n} share', '{n} shares'),
    body: `<form id="rjf" data-form="reject"><input type="hidden" name="ids" value="${esc(ids.join(','))}"><input type="hidden" name="ret" value="${esc(ret || '')}">
      <div class="field"><span>${T('Why? The moderator will see this')}</span>${reasonChips('reason')}</div>
      <p class="muted small" id="rjPrev" style="margin:-4px 0 12px">${esc(T(REASONS[0][1]))}</p>
      <label class="field"><span>${T('Or write your own note')}</span><textarea name="custom" style="min-height:64px" placeholder="${T('Optional')}"></textarea></label></form>`,
    foot: `<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn danger" type="submit" form="rjf">${icon('x', 15)} ${T('Reject')}</button>` });
}
Forms.reject = (f, fd) => {
  const ids = String(fd.get('ids') || '').split(',').filter(Boolean), r = REASONS[+fd.get('reason')] || REASONS[0];
  const note = String(fd.get('custom') || '').trim() || r[1], before = snap(ids), list = State.db.shares.filter(s => ids.includes(s.id));
  list.forEach(s => { setStatus(s, 'rejected'); s.note = note; });
  if (list.length === 1) logEvent('verify', '{by} rejected {name}\'s {where} share on {post}', shareCtx(list[0])); else logEvent('verify', '{by} rejected {n} shares at once', { n: list.length });
  App.sel = new Set(); const ret = fd.get('ret'); closeModal();
  commit(T(list.length === 1 ? 'Rejected' : '{n} shares rejected', { n: list.length }), 'error', undoAct(before));
  if (ret) openPost(ret);
};

/* ---------------- quick review: one share at a time, one check tab ---------------- */
let AUTO_OPEN = false; try { AUTO_OPEN = localStorage.getItem('sharehub_autoopen') === '1'; } catch (e) {}
function openCheckTab(url) { const w = window.open(url, 'sharehub_check'); if (w) { try { w.opener = null; } catch (e) {} } else toast(T('Allow pop-ups for this site to open links'), 'error'); }
function reviewQueue(filtered) {
  let list = pendingAll();
  if (filtered) { const q = App.q.trim().toLowerCase(), mf = App.modFilter, wf = App.whereFilter || ''; list = list.filter(s => (!mf || s.userId === mf) && (!wf || (wf === 'profile' ? !s.groupId : wf === 'group' ? !!s.groupId : s.groupId === wf)) && (!q || ((userById(s.userId) || {}).name + ' ' + (postById(s.postId) || {}).title + ' ' + targetName(s.groupId) + ' ' + s.link).toLowerCase().includes(q))); }
  return list.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map(s => s.id);
}
function startReview(filtered) {
  const ids = reviewQueue(filtered); if (!ids.length) { toast(T('No pending shares')); return; }
  closeModal(); App.review = { ids, i: 0, v: 0, r: 0, hist: [] };
  renderReview(true);
}
function curReview() { const R = App.review; while (R && R.i < R.ids.length) { const s = State.db.shares.find(x => x.id === R.ids[R.i]); if (s && s.status === 'pending') return s; R.i++; } return null; }
function renderReview(first) {
  const R = App.review; if (!R) return;
  const s = curReview(), n = R.ids.length, done = Math.min(R.i, n);
  const bar = `<div class="rv-prog"><div class="bar"><i style="width:${pct(done, n)}%"></i></div><span>${T('{d} of {n} checked', { d: done, n })}</span></div>`;
  if (!s) {
    const body = `${bar}<div class="rv-done">${icon('checkCircle', 40)}<h3>${T('All done!')}</h3><p class="muted">${T('{v} verified, {r} rejected, {s} skipped', { v: R.v, r: R.r, s: n - R.v - R.r })}</p></div>`;
    openModal({ title: T('Quick review'), body, foot: `${R.hist.length ? `<button class="btn" data-action="review-back">${icon('undo', 15)} ${T('Back')}</button><span class="spacer"></span>` : ''}<button class="btn primary" data-action="close-modal">${T('Close')}</button>` });
    $('#modal .modal').classList.add('review'); App.review = R; return;
  }
  const u = userById(s.userId), p = postById(s.postId), g = s.groupId ? groupById(s.groupId) : null;
  const body = `${bar}
    <div class="rv-who">${avatar(u, 44)}<div class="grow"><b>${esc(u ? u.name : '?')}</b><small>@${esc(u ? u.username : '')} . ${T('Submitted {t}', { t: timeAgo(s.submittedAt) })}${s.editedAt ? ' . ' + T('edited') : ''}${lateBadge(s)}</small></div>${targetBadge(s.groupId)}</div>
    <div class="rv-post">${p ? postThumb(p) : ''}<div class="grow"><b>${esc(p ? p.title : '?')}</b><small>${p ? fmtDay(p.date) + (p.time ? ', ' + fmtTime(p.time) : '') : ''}</small></div>${p && p.fbLink ? `<a class="btn sm ghost" href="${esc(p.fbLink)}" target="_blank" rel="noopener">${icon('fb', 14)} ${T('Page post')}</a>` : ''}</div>
    <div class="rv-link"><span class="rv-l">${icon('link', 16)}<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link)}</a></span><button class="btn fb" data-action="review-open">${icon('ext', 15)} ${T('Open link')} <kbd>O</kbd></button></div>
    ${g ? `<p class="muted small" style="margin:8px 0 0">${T('Group share in {group}.', { group: `<b>${esc(g.name)}</b>` })} <a href="${esc(g.url)}" target="_blank" rel="noopener">${T('Open group')}</a>${g.note ? ' . ' + esc(g.note) : ''}</p>` : ''}
    <div class="rv-reject"><span class="small"><b>${T('If you reject, reason:')}</b></span>${reasonChips('rvReason', R.reason || 0)}</div>
    <label class="check-line" style="margin-top:12px"><input type="checkbox" id="autoOpen" ${AUTO_OPEN ? 'checked' : ''}> ${T('Open each link automatically in one check tab')}</label>
    <p class="muted small rv-keys">${T('Keys: V verify, R reject, S skip, O open link, B back')}</p>`;
  const foot = `<button class="btn" data-action="review-back" ${R.hist.length ? '' : 'disabled'}>${icon('undo', 15)} ${T('Back')} <kbd>B</kbd></button><button class="btn" data-action="review-skip">${T('Skip')} <kbd>S</kbd></button><span class="spacer"></span><button class="btn danger" data-action="review-do" data-s="rejected">${icon('x', 15)} ${T('Reject')} <kbd>R</kbd></button><button class="btn success" data-action="review-do" data-s="verified">${icon('check', 15)} ${T('Verify')} <kbd>V</kbd></button>`;
  openModal({ title: T('Quick review'), sub: T('Check the link, then verify or reject. The next one opens by itself.'), size: 'lg', body, foot });
  $('#modal .modal').classList.add('review'); if (!first) $('#modal .modal').classList.add('no-anim');
  App.review = R;
  if (AUTO_OPEN && R.autoNext) { R.autoNext = false; openCheckTab(s.link); }
}
async function reviewDo(st) {
  const R = App.review, s = curReview(); if (!R || !s) return;
  const chosen = $('#modal input[name=rvReason]:checked'); R.reason = chosen ? +chosen.value : 0;
  const previous = snap([s.id])[0], version = Cloud.recordVersion('shares',s.id);
  setStatus(s, st); if (st === 'rejected') s.note = REASONS[R.reason][1];
  logEvent('verify', st === 'verified' ? '{by} verified {name}\'s {where} share on {post}' : '{by} rejected {name}\'s {where} share on {post}', shareCtx(s));
  if (!await commit()) { renderReview(); return; }
  R.hist.push({i:R.i,prev:previous,st,version:version ? version + 1 : null});
  st === 'verified' ? R.v++ : R.r++; R.i++; R.autoNext = true; renderReview();
}
Object.assign(Actions, {
  'review-start': el => startReview(!!el.dataset.filtered),
  'review-do': el => reviewDo(el.dataset.s),
  'review-skip': () => { const R = App.review; if (!R || !curReview()) return; R.hist.push({ i: R.i, skip: true }); R.i++; R.autoNext = true; renderReview(); },
  'review-open': () => { const s = curReview(); if (s) openCheckTab(s.link); },
  'review-back': async () => {
    const R = App.review; if (!R || !R.hist.length) return;
    const h = R.hist.at(-1);
    if (!h.skip) {
      if (MODE === 'cloud' && Cloud.recordVersion('shares',h.prev.id) !== h.version) { toast(T('This record changed. Refresh before undoing.'), 'error'); return; }
      const s = State.db.shares.find(x => x.id === h.prev.id); if (s) Object.assign(s, h.prev);
      if (!await commit()) return;
      h.st === 'verified' ? R.v-- : R.r--;
    }
    R.hist.pop(); R.i = h.i; renderReview();
  },
});
document.addEventListener('keydown', e => {
  if (!App.review || !$('#modal').classList.contains('open') || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'radio') return;
  const k = e.key.toLowerCase(), map = { v: () => reviewDo('verified'), r: () => reviewDo('rejected'), s: () => Actions['review-skip'](), o: () => Actions['review-open'](), b: () => Actions['review-back']() };
  if (map[k]) { e.preventDefault(); runEvent(map[k]); }
});

/* ---------------- reminders (WhatsApp or copy) ---------------- */
function remindText(u, day) {
  const { rows } = dayData(day), r = rows.find(x => x.u.id === u.id);
  const items = r ? r.tasks.filter(x => !x.share || x.share.status === 'rejected').map(x => `- ${x.p.title} (${x.groupId ? targetName(x.groupId) : T('Profile')}${x.share ? ', ' + T('rejected') : ''})`) : [];
  return T('Hi {name}, please share these posts for {d}:', { name: firstName(u), d: fmtDay(day) }) + '\n' + (items.length ? items.join('\n') : '- ' + T('All tasks are done, thank you!')) + '\n' + T('Then submit your links in the dashboard.') + (modUrl() ? '\n' + modUrl() : '');
}
Actions.remind = el => {
  const u = userById(el.dataset.id); if (!u) return;
  const msg = remindText(u, el.dataset.day || todayYmd()), n = waNumber(u.phone);
  if (n) { window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(msg), '_blank', 'noopener'); logEvent('user', '{by} sent a reminder to {name}', { name: u.name }); saveDB(State.db); }
  else copyText(msg, T('No WhatsApp number saved. The message is copied, paste it anywhere.'));
};

/* ---------------- notice for moderators ---------------- */
function noticeBar() {
  const n = State.db.settings.notice, live = activeNotice();
  if (!n || !n.text) return `<div class="notice-bar empty"><span class="nb-ic">${icon('megaphone', 16)}</span><span class="muted">${T('No notice for moderators right now.')}</span><span class="spacer"></span><button class="btn sm" data-action="notice-edit">${icon('plus', 14)} ${T('Post a notice')}</button></div>`;
  return `<div class="notice-bar ${live ? '' : 'off'}"><span class="nb-ic">${icon('megaphone', 16)}</span><div class="grow"><b>${T(live ? 'Notice shown to moderators' : 'Notice expired')}</b><p>${esc(n.text)}</p><small class="muted">${fmtDT(n.at)}${n.until ? ' . ' + T('until {d}', { d: fmtDate(n.until) }) : ''}</small></div><button class="btn sm" data-action="notice-edit">${icon('edit', 14)} ${T('Edit')}</button><button class="icon-btn sm bad" data-action="notice-remove" aria-label="${T('Remove')}" title="${T('Remove')}">${icon('trash', 14)}</button></div>`;
}
Object.assign(Actions, {
  'notice-edit': () => {
    const n = State.db.settings.notice || {};
    openModal({ title: T('Notice for moderators'), sub: T('Shown at the top of every moderator\'s dashboard and in their notifications'), size: 'sm',
      body: `<form id="nf" data-form="notice"><label class="field"><span>${T('Message')} *</span><textarea name="text" maxlength="500" required placeholder="${T('e.g. Big campaign tomorrow at 8 PM. Everyone please share within 1 hour.')}">${esc(n.text || '')}</textarea></label>
        <label class="field"><span>${T('Show until (optional)')}</span><input type="date" name="until" value="${esc(n.until || '')}" min="${todayYmd()}"></label></form>`,
      foot: `<button class="btn" data-action="close-modal">${T('Cancel')}</button><button class="btn primary" type="submit" form="nf">${icon('megaphone', 15)} ${T('Publish')}</button>` });
  },
  'notice-remove': () => confirmBox(T('Remove notice?'), T('Moderators will no longer see it.'), () => { State.db.settings.notice = null; logEvent('system', '{by} removed the notice'); commit(T('Notice removed')); }, T('Remove')),
  'copy-modlink': () => { const u = modUrl(); copyText(u ? T('Moderator login: {u}', { u }) : T('Send the moderator.html file to your team.'), T(u ? 'Moderator link copied' : 'Copied to clipboard')); },
  'hide-setup': () => { State.db.settings.hideSetup = true; commit(); },
});
Forms.notice = (f, fd) => {
  const text = String(fd.get('text') || '').trim(); if (!text) { toast(T('Write a message'), 'error'); return; }
  State.db.settings.notice = { text, until: fd.get('until') || '', at: new Date().toISOString(), by: App.user.id };
  logEvent('system', '{by} posted a notice for moderators'); closeModal(); commit(T('Notice published'));
};

/* ---------------- first-time setup checklist + health warnings ---------------- */
function setupHTML() {
  const S = State.db.settings; if (S.demo || S.hideSetup) return '';
  const steps = [
    [!!(S.pageName && S.pageName !== 'Your Facebook Page' && S.pageUrl), 'Add your Facebook page name and link', 'nav', 'data-page="settings"'],
    [activeMods().length > 0, 'Add your moderators', 'new-mod', ''],
    [State.db.groups.length > 0, 'Add Facebook groups (if you share in groups)', 'new-group', ''],
    [State.db.posts.some(p => p.fbLink), 'Add your first post with its page link', 'new-post', ''],
    [State.db.shares.length > 0, 'Send the moderator login link to your team', 'copy-modlink', ''],
  ];
  const done = steps.filter(x => x[0]).length; if (done === steps.length) return '';
  return `<div class="card setup"><div class="card-h"><div><h3>${icon('rocket', 16)} ${T('Getting started')}</h3><p>${T('{d} of {n} steps done', { d: done, n: steps.length })}</p></div><button class="btn sm ghost" data-action="hide-setup">${T('Hide')}</button></div>
    <div class="setup-list">${steps.map(([ok, l, a, extra]) => `<button class="setup-step ${ok ? 'ok' : ''}" data-action="${a}" ${extra}><span class="ss-ic">${icon(ok ? 'check' : 'chevR', 14)}</span><span>${T(l)}</span></button>`).join('')}</div></div>`;
}
function healthHTML() {
  const S = State.db.settings, out = [], used = storeUse();
  if (MODE === 'cloud') return '';
  if (used > 75) out.push(`<div class="note warn">${icon('alert', 16)}<span>${T('Browser storage is {p}% full. Download a backup and use smaller images.', { p: used })}</span></div>`);
  if (isSuper() && !S.demo && State.db.posts.length && (!S.lastBackup || Date.now() - new Date(S.lastBackup) > 7 * 86400000)) out.push(`<div class="note warn">${icon('download', 16)}<span>${S.lastBackup ? T('Your last backup was {t}.', { t: timeAgo(S.lastBackup) }) : T('You have not downloaded a backup yet.')} ${T('All data lives in this browser, so keep a backup.')}</span><button class="btn sm" data-action="export-json" style="margin-left:auto">${T('Download backup')}</button></div>`);
  return out.join('');
}

/* ---------------- notifications ---------------- */
function notifItems() {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  return State.db.shares.filter(s => s.submittedAt > since).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 40).map(s => {
    const u = userById(s.userId), p = postById(s.postId); if (!u || !p) return null;
    return { at: s.submittedAt, ic: s.status === 'pending' ? 'share' : s.status === 'verified' ? 'checkCircle' : 'xCircle', tone: s.status === 'pending' ? 'fb' : s.status === 'verified' ? 'success' : 'danger',
      html: T(s.editedAt ? '{name} sent a new {where} link for {post}' : '{name} submitted a {where} link for {post}', { name: `<b>${esc(u.name)}</b>`, where: esc(s.groupId ? targetName(s.groupId) : T('Profile')), post: `<b>${esc(p.title)}</b>` }) + ` ${statusBadge(s.status)}`,
      act: `data-action="open-post" data-id="${p.id}"` };
  }).filter(Boolean);
}

/* ---------------- change events ---------------- */
function onChange(t) {
  if (t.id === 'imgFile') { readImage(t.files[0], url => { if (!$('#imgVal')) return; $('#imgVal').value = url; $('#imgPrev').innerHTML = `<img src="${url}" alt="">`; }); return; }
  if (t.classList.contains('day-pick')) { App.dayView = t.value && t.value !== todayYmd() ? t.value : ''; renderPage(); return; }
  if (t.name === 'langPick') { setLang(t.value); return; }
  if (t.name === 'reason') { const pv = $('#rjPrev'); if (pv) pv.textContent = T(REASONS[+t.value][1]); return; }
  if (t.id === 'autoOpen') { AUTO_OPEN = t.checked; try { localStorage.setItem('sharehub_autoopen', AUTO_OPEN ? '1' : '0'); } catch (e) {} return; }
  if (t.id === 'deadlineSel') { State.db.settings.deadlineHours = +t.value; logEvent('system', '{by} set the share deadline to {n} hours', { n: +t.value }); commit(T('Saved')); return; }
  if (t.dataset.dsel) { t.checked ? App.dsel.add(t.dataset.dsel) : App.dsel.delete(t.dataset.dsel); renderPage(); return; }
  if (t.hasAttribute('data-dsel-all')) { $$('[data-dsel]').forEach(c => t.checked ? App.dsel.add(c.dataset.dsel) : App.dsel.delete(c.dataset.dsel)); renderPage(); return; }
  if (t.dataset.sel) { t.checked ? App.sel.add(t.dataset.sel) : App.sel.delete(t.dataset.sel); renderPage(); return; }
  if (t.hasAttribute('data-sel-all')) { $$('[data-sel]').forEach(c => t.checked ? App.sel.add(c.dataset.sel) : App.sel.delete(c.dataset.sel)); renderPage(); return; }
  if (t.name === 'assign') { const mp = $('#modPicks'); if (mp) mp.hidden = t.value !== 'selected'; return; }
  if (t.id === 'gsToggle') { const w = $('#gtWrap'); if (w) w.hidden = !t.checked; return; }
  if (t.dataset.toggleGroup) { const g = groupById(t.dataset.toggleGroup); g.active = t.checked; logEvent('group', g.active ? '{by} turned on the group {group}' : '{by} turned off the group {group}', { group: g.name }); commit(T(g.active ? '{name} is now active' : '{name} is now inactive', { name: g.name })); return; }
  if (t.dataset.toggleMod) { const u = userById(t.dataset.toggleMod); u.active = t.checked; logEvent('user', u.active ? '{by} activated {name}' : '{by} deactivated {name}', { name: u.name }); commit(T(u.active ? '{name} is now active' : '{name} is now inactive', { name: u.name })); return; }
  if (t.id === 'importFile') {
    if (!isSuper()) return;
    const file = t.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.users) || !Array.isArray(d.posts) || !Array.isArray(d.shares) || !d.users.some(u => isAdminRole(u.role))) throw new Error('bad');
        confirmBox(T('Import backup?'), T('{p} posts, {m} moderators and {s} shares will be imported. Current data will be replaced.', { p: d.posts.length, m: d.users.filter(u => u.role === 'moderator').length, s: d.shares.length }), () => {
          State.db = normalizeDB(d);
          const me = State.db.users.find(u => u.id === App.user.id && isAdminRole(u.role));
          if (me) { App.user = me; logEvent('system', '{by} imported a backup'); commit(T('Import complete')); } else { saveDB(State.db); toast(T('Import complete. Please log in again.')); logout(); }
        }, T('Import'), false);
      } catch (e) { toast(T('That JSON file is not valid'), 'error'); }
    };
    r.readAsText(file); t.value = '';
  }
}


configureHooks({PAGES,NAV,DEFAULT_PAGE,CHIP,openPost,notifItems,onChange,CTA:typeof CTA==='undefined'?undefined:CTA,BOTTOM:typeof BOTTOM==='undefined'?[]:BOTTOM});
installCloudUI({ROLE,State,App,Forms,Actions,PAGES,render,renderPage,openPost,openModal,closeModal,toast,T,esc,icon,commit,logEvent,userById,confirmBox,normalizeDB,boot});
boot();
