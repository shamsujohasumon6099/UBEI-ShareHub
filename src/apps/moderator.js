import {$,$$} from '../core/application.js';
import { esc, MON, DOW, T, monthLabel, fmtDate, fmtDay, fmtTime, fmtDT, timeAgo, uid, shortUrl, pct, firstName, TAGS, icon, avatar, statusBadge, emptyHTML, kpi, postThumb, postMedia, State, App, logEvent, commit, noteText, userById, postById, canShare, byDateTime, groupById, shareFor, targetName, tasksFor, tasksOfUser, targetBadge, monthShares, lateBadge, dueBadge, statsFor, sheetPeople, leaderboard, shareablePosts, activeNotice, toast, openModal, confirmBox, copyText, render, calendarHTML, lbRows, leaderboardPage, shortTarget, sheetPage, postInfo, shareRows, profilePage, Actions, Forms, boot, parseYmd, todayYmd, isLive, isFbUrl, cleanLink, sameLink, looksLikePost, configureHooks, MODE, renderPage, closeModal, normalizeDB, ROLE } from '../core/application.js';
import { installCloudUI } from '../services/cloud-ui.js';
/* =====================================================
   UBEI ShareHub . MODERATOR app
   ===================================================== */
const DEFAULT_PAGE = 'home';
/* my tasks on live posts: assigned tasks plus any share I already sent */
function myTasks(md) {
  const me = App.user.id, out = [];
  shareablePosts(md).forEach(p => tasksOfUser(p, me).forEach(r => { if (r.assigned || r.share) out.push({ p, ...r }); }));
  return out;
}
const latestFirst = (a, b) => (b.p.date + (b.p.time || '')).localeCompare(a.p.date + (a.p.time || ''));
const myTodo = () => myTasks().filter(t => t.assigned && !t.share).sort(latestFirst);
const myRedo = () => myTasks().filter(t => t.share && t.share.status === 'rejected').sort(latestFirst);
/* today's tasks count even when the month switcher shows another month */
const myTodayTasks = () => { const t = todayYmd(); return State.db.posts.filter(p => p.date === t).sort(byDateTime).flatMap(p => tasksOfUser(p, App.user.id).filter(r => r.assigned || r.share).map(r => ({ p, ...r }))); };
const NAV = [
  { section: 'Main' },
  { id: 'home', label: 'My Dashboard', icon: 'home' },
  { id: 'calendar', label: 'Post Calendar', icon: 'calendar', badge: () => myTodo().length || '' },
  { id: 'shares', label: 'Team Shares', icon: 'share' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { id: 'sheet', label: 'Monthly Sheet', icon: 'table' },
  { section: 'Account' },
  { id: 'profile', label: 'My Profile', icon: 'user' },
];
const CTA = null;
/* phone bottom bar */
const BOTTOM = [{ id: 'home', label: 'Home' }, { id: 'calendar', label: 'Calendar' }, { id: 'shares', label: 'Shares' }, { id: 'leaderboard', label: 'Rank' }, { id: 'profile', label: 'Profile' }];

function CHIP(p) {
  const list = tasksOfUser(p, App.user.id);
  let c = 'c-sched', meta = p.time ? fmtTime(p.time) : T('Soon');
  if (!list.length) { c = 'c-none'; meta = T('No task'); }
  else if (canShare(p)) {
    const done = list.filter(r => r.share).length;
    if (list.some(r => !r.share || r.share.status === 'rejected')) { c = 'c-todo'; meta = list.some(r => r.share && r.share.status === 'rejected') ? T('Redo') : `${done}/${list.length}`; }
    else if (list.some(r => r.share.status === 'pending')) { c = 'c-pending'; meta = T('In review'); }
    else { c = 'c-verified'; meta = T('Done'); }
  }
  return `<button class="chip ${c}" style="--chip:${TAGS[p.tag] || TAGS.Other}" data-action="open-post" data-id="${p.id}" title="${esc(p.title)}"><i class="dot"></i><span class="chip-t">${esc(p.title)}</span><span class="chip-m">${meta}</span></button>`;
}

function ring(v, total) {
  const r = 40, c = 2 * Math.PI * r, p = total ? Math.min(1, v / total) : 0;
  return `<div class="ring" role="img" aria-label="${pct(v, total)}%"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="${r}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg><b>${pct(v, total)}%</b><small>${T('done this month')}</small></div>`;
}

const PAGES = {
  home: {
    title: 'My Dashboard', sub: () => T('Your share progress, {m}', { m: monthLabel(App.month) }),
    render() {
      const me = App.user, st = statsFor(me.id), todo = myTodo(), redo = myRedo();
      const assignedDone = myTasks().filter(t => t.assigned && t.share).length;
      const lb = leaderboard(), rank = lb.findIndex(r => r.u.id === me.id) + 1;
      const heroText = st.expected
        ? T('You have {e} share tasks this month (profile + group). You sent links for {d}, and {v} are verified.', { e: st.expected, d: assignedDone, v: st.verified }) + ' ' + (todo.length ? T('{n} new tasks left.', { n: todo.length }) : T('All new tasks are done, great job!')) + (redo.length ? ' ' + T('{n} rejected need fixing.', { n: redo.length }) : '')
        : T('You have no share tasks this month yet.');
      const hero = `<div class="card hero"><div><h2>${T('Hello, {name}!', { name: esc(firstName(me)) })}</h2><p>${heroText}</p>${todo.length ? `<button class="btn" data-action="open-task" data-id="${todo[0].p.id}" data-group="${todo[0].groupId || ''}">${icon('share', 15)} ${T('Start the latest task')}</button>` : ''}</div>${ring(assignedDone, st.expected)}</div>`;
      const today = myTodayTasks(), tDone = today.filter(r => r.share).length;
      const todayStrip = today.length ? `<div class="card my-today ${tDone === today.length ? 'done' : ''}"><div class="mt-h">${icon('calendar', 16)}<b>${T('Today')}</b><span class="muted small">${fmtDay(todayYmd())}</span><span class="spacer"></span><span class="badge ${tDone === today.length ? 'b-verified' : 'b-rejected'}">${T('{s} of {t} done', { s: tDone, t: today.length })}</span></div><div class="mt-list">${today.map(r => `<button class="tpill m-${r.share ? r.share.status : (canShare(r.p) ? 'none' : 'sched')}" data-action="open-task" data-id="${r.p.id}" data-group="${r.groupId || ''}">${icon(r.share ? { verified: 'check', pending: 'clock', rejected: 'x' }[r.share.status] : 'alert', 11)}<span>${esc(r.p.title)} . ${esc(shortTarget(r.groupId))}</span></button>`).join('')}</div></div>` : '';
      const kp = `<div class="grid kpis">
        ${kpi(T('New tasks left'), todo.length, todo.length ? T('out of {n} tasks', { n: st.expected }) : T('Nothing left'), 'target', 'accent')}
        ${kpi(T('Rejected'), redo.length, T(redo.length ? 'Fix and send a new link' : 'Nothing rejected'), 'xCircle', 'danger')}
        ${kpi(T('Pending review'), st.pending, T('An admin will check'), 'clock', 'warn')}
        ${kpi(T('Verified'), st.verified, T('{p} profile, {g} group sent', { p: st.profile, g: st.group }), 'checkCircle', 'success')}
        ${kpi(T('My rank'), rank ? '#' + rank : '-', T('out of {n} people', { n: lb.length }), 'trophy', 'fb')}
      </div>`;
      const todoHTML = todo.length ? todo.map(t => taskRowHTML(t)).join('') : emptyHTML('checkCircle', T('No new tasks left'), T('New posts from the admin will appear here, newest first.'));
      const redoHTML = redo.map(t => { const p = t.p, s = t.share; return `<div class="fix-item">
          <div class="fix-top">${postThumb(p)}<div class="grow"><b>${esc(p.title)}</b><small>${targetBadge(t.groupId)} ${fmtDay(p.date)}</small></div></div>
          <div class="note bad" style="margin:8px 0">${icon('alert', 15)}<span>${s.note ? `<b>${T('Admin note:')}</b> ` + esc(noteText(s.note)) : T('The link was not valid. Share again and submit a new link.')}</span></div>
          <div class="step-act" style="margin-bottom:8px">${shareButtons(p, t.groupId)}</div>
          <form class="submit-row" data-form="submit-share"><input type="hidden" name="postId" value="${p.id}"><input type="hidden" name="groupId" value="${t.groupId || ''}"><div class="link-in"><input class="input" name="link" type="url" required placeholder="${T('Paste the new link')}" aria-label="${T('New link')}">${pasteBtn()}</div><button class="btn primary" type="submit">${T('Resubmit')}</button></form>
        </div>`; }).join('');
      const mine = State.db.shares.filter(s => s.userId === me.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6);
      const recent = mine.length ? mine.map(s => { const p = postById(s.postId); if (!p) return ''; return `<div class="list-row clickable" data-action="open-post" data-id="${p.id}" tabindex="0" role="button">${postThumb(p)}<div class="grow"><b>${esc(p.title)}</b><small>${esc(targetName(s.groupId))} . ${timeAgo(s.submittedAt)}</small></div>${statusBadge(s.status)}</div>`; }).join('') : emptyHTML('share', T('No shares yet'));
      return `${noticeBanner()}${hero}${todayStrip}${kp}
      <div class="grid cols-2">
        <div class="card"><div class="card-h"><div><h3>${T('To share')}</h3><p>${T('Newest tasks first. The share button opens Facebook; share, then submit the link.')}</p></div><span class="badge ${todo.length ? 'b-sched' : 'b-verified'}">${T('{n} left', { n: todo.length })}</span></div>${todoHTML}</div>
        <div class="stack-16">
          ${redo.length ? `<div class="card fix-card"><div class="card-h"><div><h3>${icon('xCircle', 16)} ${T('Rejected: needs fixing')}</h3><p>${T('Read the admin note, share again, then submit a new link')}</p></div><span class="badge b-rejected">${redo.length}</span></div><div class="card-b">${redoHTML}</div></div>` : ''}
          <div class="card"><div class="card-h"><div><h3>${T('Leaderboard')}</h3><p>${T('By verified shares')}</p></div><button class="btn sm ghost" data-action="nav" data-page="leaderboard">${T('All')} ${icon('chevR', 14)}</button></div><div style="padding:6px 0">${lbRows(5)}</div></div>
          <div class="card"><div class="card-h"><div><h3>${T('My recent submissions')}</h3></div><button class="btn sm ghost" data-action="nav" data-page="shares">${T('All')} ${icon('chevR', 14)}</button></div>${recent}</div>
        </div>
      </div>`;
    }
  },
  calendar: {
    title: 'Post Calendar', sub: () => T('All posts from the admin, by date. Click a post to share it.'),
    render() {
      return `<div class="toolbar"><div class="legend"><span><i style="--d:#EF4444"></i>${T('To share / Rejected')}</span><span><i style="--d:#F59E0B"></i>${T('In review')}</span><span><i style="--d:#10B981"></i>${T('Verified')}</span><span><i style="--d:#94A3B8"></i>${T('No task for you')}</span><span><i class="dash"></i>${T('Scheduled (not live yet)')}</span></div></div>${calendarHTML()}`;
    }
  },
  shares: {
    title: 'Team Shares', search: 'Search post or name...', sub: () => T('You can see everyone\'s shares, but only edit your own'),
    render() {
      const me = App.user.id, q = App.q.trim().toLowerCase(), who = App.tab === 'mine' ? 'mine' : 'all', mf = App.modFilter;
      let list = monthShares().filter(s => (who === 'all' || s.userId === me) && (!mf || s.userId === mf));
      list = list.filter(s => !q || ((userById(s.userId) || {}).name + ' ' + (postById(s.postId) || {}).title + ' ' + targetName(s.groupId)).toLowerCase().includes(q)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const people = sheetPeople();
      const tb = `<div class="toolbar"><div class="tabs"><button class="tab ${who === 'all' ? 'active' : ''}" data-action="set" data-key="tab" data-val="all">${T('Everyone')}</button><button class="tab ${who === 'mine' ? 'active' : ''}" data-action="set" data-key="tab" data-val="mine">${T('Only mine')}</button></div>${who === 'all' ? `<select class="input" data-filter="modFilter" aria-label="${T('Filter by moderator')}"><option value="">${T('All moderators')}</option>${people.map(u => `<option value="${u.id}" ${mf === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}<span class="spacer"></span><span class="lock">${icon('lock', 14)} ${T('Other people\'s shares are view only')}</span></div>`;
      if (!list.length) return tb + `<div class="card">${emptyHTML('share', T('No shares found'))}</div>`;
      const rows = list.map(s => { const u = userById(s.userId), p = postById(s.postId); if (!u || !p) return ''; const mine = s.userId === me; return `<tr class="${mine ? 'mine' : ''}"><td><div class="person">${avatar(u, 30)}<div><b>${esc(u.name)}${mine ? ' ' + T('(you)') : ''}</b><small>@${esc(u.username)}</small></div></div></td><td><div class="cell-post clickable" data-action="open-post" data-id="${p.id}">${postThumb(p)}<div><b>${esc(p.title)}</b><small>${fmtDate(p.date)}</small></div></div></td><td>${targetBadge(s.groupId)}</td><td><a class="lnk" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('ext', 14)}<span>${esc(shortUrl(s.link))}</span></a></td><td>${timeAgo(s.submittedAt)}</td><td>${statusBadge(s.status)}${lateBadge(s)}${mine && s.note ? `<br><small class="muted">${esc(noteText(s.note))}</small>` : ''}</td><td><div class="acts">${mine ? `<button class="icon-btn sm" data-action="open-task" data-id="${p.id}" data-group="${s.groupId || ''}" title="${T('Edit my link')}" aria-label="${T('Edit my link')}">${icon('edit', 15)}</button>${s.status === 'pending' ? `<button class="icon-btn sm bad" data-action="remove-share" data-id="${s.id}" title="${T('Remove')}" aria-label="${T('Remove')}">${icon('trash', 15)}</button>` : ''}` : `<span class="lock" title="${T('View only')}">${icon('lock', 14)}</span>`}</div></td></tr>`; }).join('');
      return tb + `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>${T('Moderator')}</th><th>${T('Post')}</th><th>${T('Where')}</th><th>${T('Shared link')}</th><th>${T('Submitted')}</th><th>${T('Status')}</th><th class="num">${T('Action')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
  },
  leaderboard: { title: 'Leaderboard', sub: () => T('Moderator ranking, {m}', { m: monthLabel(App.month) }), render: leaderboardPage },
  sheet: { title: 'Monthly Sheet', sub: () => T('Monthly share sheet and posting schedule'), render: sheetPage },
  profile: { title: 'My Profile', month: false, sub: () => T('Photo, email, Facebook link and password'), render: profilePage },
};

/* ---------------- share helpers ---------------- */
const sharerUrl = p => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(p.fbLink);
/* main share button + copy link, for a profile task or a group task */
function shareButtons(p, gid, compact) {
  const copy = `<button class="btn sm" data-action="copy" data-text="${esc(p.fbLink)}">${icon('copy', 14)} ${T('Copy post link')}</button>`;
  if (gid) {
    const g = groupById(gid), name = esc(g ? g.name : T('group'));
    const hint = `<div class="share-hint">${icon('alert', 13)}<span>${T('One click copies the post link and opens <b>{group}</b>. Click "Write something...", paste (Ctrl+V), write a few words and Post.', { group: name })}</span></div>`;
    return `<button class="btn sm fb" data-action="share-group" data-post="${p.id}" data-group="${gid}">${icon('users', 14)} ${T('Share in {group}', { group: name })}</button>${copy}${compact ? '' : `<a class="btn sm ghost" href="${esc(sharerUrl(p))}" target="_blank" rel="noopener" title="${esc(T('In the share box, click "Feed", choose Group, then pick the group'))}">${icon('share', 14)} ${T('FB share box')}</a>`}${hint}`;
  }
  return `<a class="btn sm fb" href="${esc(sharerUrl(p))}" target="_blank" rel="noopener">${icon('fb', 14)} ${T('Share on my profile')}</a>${copy}${compact ? '' : `<div class="share-hint">${icon('alert', 13)}<span>${T('If the audience says <b>"Friends"</b>, change it to <b>Public</b>, then Next > Share.')}</span></div>`}`;
}
function taskRowHTML(t) {
  const p = t.p, d = parseYmd(p.date), today = p.date === todayYmd();
  return `<div class="task-row">
    <div class="date-box ${today ? 'is-today' : ''}"><b>${d.getDate()}</b><span>${today ? T('Today') : MON[d.getMonth()]}</span></div>
    <div class="grow"><b>${esc(p.title)}</b><small>${targetBadge(t.groupId)} ${DOW[d.getDay()]}${p.time ? ', ' + fmtTime(p.time) : ''} ${dueBadge(p)}</small></div>
    <div class="task-acts">${shareButtons(p, t.groupId, true)}<button class="btn sm primary" data-action="open-task" data-id="${p.id}" data-group="${t.groupId || ''}">${icon('link', 14)} ${T('Submit link')}</button></div>
  </div>`;
}

/* ---------------- post modal ---------------- */
function taskItem(p, r) {
  const s = r.share, g = r.groupId ? groupById(r.groupId) : null;
  const how = g
    ? T('"Share in {group}" copies the post link and opens the group. In the group, click "Write something...", paste the link (Ctrl+V, or long-press > Paste on phone), write a few words and Post. Then copy the link of your group post and paste it here.', { group: `<b>${esc(g.name)}</b>` })
    : T('"Share on my profile" opens the Facebook share box. Set it to Public and share. Then paste the link of your shared post here.');
  return `<div class="task ${s ? 't-' + s.status : 't-none'}" data-task="${r.groupId || 'profile'}">
    <div class="task-h">${targetBadge(r.groupId)}${r.assigned ? '' : `<span class="muted small">${T('No longer assigned')}</span>`}<span class="spacer"></span>${s ? lateBadge(s) : dueBadge(p)}${statusBadge(s ? s.status : 'none')}</div>
    <p class="task-how">${how}</p>
    ${s && s.status === 'rejected' ? `<div class="note bad">${icon('alert', 16)}<span><b>${T('Rejected.')}</b> ${s.note ? T('Admin note:') + ' ' + esc(noteText(s.note)) : T('Submit a new link.')}</span></div>` : ''}
    <div class="step-act" style="margin-bottom:8px">${shareButtons(p, r.groupId)}</div>
    <form class="submit-row" data-form="submit-share"><input type="hidden" name="postId" value="${p.id}"><input type="hidden" name="groupId" value="${r.groupId || ''}"><div class="link-in"><input class="input" name="link" type="url" required placeholder="${g ? 'https://www.facebook.com/groups/.../posts/...' : 'https://www.facebook.com/share/p/...'}" value="${esc(s ? s.link : '')}" aria-label="${esc(targetName(r.groupId))}">${pasteBtn()}</div><button class="btn primary" type="submit">${T(s ? (s.status === 'rejected' ? 'Resubmit' : 'Update') : 'Submit')}</button></form>
    ${s ? `<small class="muted" style="display:block;margin-top:6px">${T('Submitted {t}', { t: fmtDT(s.submittedAt) })}${s.status === 'verified' ? '. ' + T('If you change the link it goes back to Pending.') : ''}${s.status === 'pending' ? ` . <a href="#" data-action="remove-share" data-id="${s.id}">${T('Remove')}</a>` : ''}</small>` : ''}
  </div>`;
}
function openPost(id, focusGid) {
  const p = postById(id); if (!p) return;
  const me = App.user.id, list = tasksOfUser(p, me);
  let mine;
  if (!list.length) mine = `<div class="note" style="margin-top:16px">${icon('alert', 16)}<span>${T('You have no share task on this post. You can see the team\'s tasks below.')}</span></div>`;
  else if (!canShare(p)) mine = `<div class="note" style="margin-top:16px">${icon('clock', 16)}<span>${T('You have {n} tasks here ({where}).', { n: list.length, where: list.map(r => esc(targetName(r.groupId))).join(', ') })} ${isLive(p) ? T('The admin has not added the page post link yet.') : T('The post goes live on {d}.', { d: fmtDay(p.date) })} ${T('You can share it then.')}</span></div>`;
  else {
    const done = list.filter(r => r.share).length;
    mine = `<div class="my-share"><div class="ms-head"><h4>${T('Your tasks ({d}/{t})', { d: done, t: list.length })}</h4></div>${list.map(r => taskItem(p, r)).join('')}</div>`;
  }
  openModal({ title: T('Post details'), sub: T('Share it, then submit the link'), size: 'lg',
    body: `<div class="post-view"><div>${postMedia(p)}</div><div>${postInfo(p)}${mine}</div></div><div class="sec-title">${T('Team tasks')} <span class="spacer"></span><span class="lock">${icon('lock', 13)} ${T('Other people\'s tasks are view only')}</span></div>${shareRows(p, 'mod')}` });
  App.modalPost = p.id;
  if (focusGid !== undefined) setTimeout(() => {
    const box = $(`#modal .task[data-task="${focusGid || 'profile'}"]`);
    if (box) { box.scrollIntoView({ block: 'center' }); box.classList.add('flash'); const inp = box.querySelector('input[name=link]'); inp && inp.focus({ preventScroll: true }); }
  }, 60);
}

/* ---------------- forms ---------------- */
Forms['submit-share'] = (f, fd) => {
  const me = App.user.id, p = postById(fd.get('postId')), gid = fd.get('groupId') || null, link = cleanLink(fd.get('link'));
  if (!p || !canShare(p)) { toast(T('You cannot submit a share for this post right now'), 'error'); return; }
  const ex = shareFor(p.id, me, gid);
  const task = tasksFor(p).some(t => t.userId === me && (t.groupId || null) === gid);
  if (!task && !ex) { toast(T('You were not given a task to share here'), 'error'); return; }
  if (!isFbUrl(link)) { toast(T('Enter a valid Facebook link (facebook.com)'), 'error'); return; }
  if (p.fbLink && sameLink(link, p.fbLink)) { toast(T('That is the page\'s link. Paste the link of the post you shared.'), 'error'); return; }
  if (gid) { const g = groupById(gid); if (g && sameLink(link, g.url)) { toast(T('That is the group\'s main link. Paste the link of the post you shared in the group.'), 'error'); return; } }
  if (!looksLikePost(link)) { toast(T('That looks like a profile or page link. Open your shared post and copy its link.'), 'error'); return; }
  const dup = State.db.shares.find(x => sameLink(x.link, link) && (!ex || x.id !== ex.id));
  if (dup) { toast(T('This link was already used in another submission'), 'error'); return; }
  const ctx = { post: p.title, where: gid ? targetName(gid) : 'Profile' };
  if (ex) {
    if (sameLink(ex.link, link) && ex.status !== 'rejected') { toast(T('The link is the same, nothing changed')); return; }
    const wasRejected = ex.status === 'rejected';
    ex.firstAt = ex.firstAt || ex.submittedAt; ex.link = link; ex.editedAt = new Date().toISOString(); ex.submittedAt = ex.editedAt; ex.status = 'pending'; ex.checkedAt = null; ex.checkedBy = null; ex.note = '';
    logEvent('share', wasRejected ? '{by} resubmitted the {where} link for {post}' : '{by} changed the {where} link for {post}', ctx);
    commit(T('Link updated, an admin will check it again'));
  } else {
    const now = new Date().toISOString();
    State.db.shares.push({ id: uid('s'), postId: p.id, userId: me, groupId: gid, link, submittedAt: now, firstAt: now, status: 'pending', checkedAt: null, checkedBy: null, note: '' });
    logEvent('share', '{by} submitted a {where} link for {post}', ctx);
    commit(T(gid ? 'Group share submitted!' : 'Share submitted! An admin will check it.'));
  }
};
Object.assign(Actions, {
  'open-task': el => openPost(el.dataset.id, el.dataset.group || ''),
  'share-group': el => {
    const p = postById(el.dataset.post), g = groupById(el.dataset.group); if (!p || !g) return;
    copyText(p.fbLink, T('Post link copied'));
    window.open(g.url, '_blank', 'noopener');
    showGuide(p, g);
  },
  'remove-share': el => {
    const s = State.db.shares.find(x => x.id === el.dataset.id);
    if (!s || s.userId !== App.user.id || s.status !== 'pending') { toast(T('You can only remove your own pending shares'), 'error'); return; }
    const ret = App.modalPost, p = postById(s.postId);
    confirmBox(T('Remove share?'), T('Your share link will be deleted and your count will go down.'), () => { State.db.shares = State.db.shares.filter(x => x.id !== s.id); logEvent('share', '{by} removed their {where} link for {post}', { post: p ? p.title : '', where: s.groupId ? targetName(s.groupId) : 'Profile' }); commit(T('Share removed')); if (ret) openPost(ret); }, T('Remove'));
  },
});
/* small floating guide shown after "Share in group" opens the group in a new tab */
function showGuide(p, g) {
  let box = $('#guide');
  if (!box) { box = document.createElement('div'); box.id = 'guide'; document.body.appendChild(box); }
  box.innerHTML = `<div class="guide-card" role="dialog" aria-label="${esc(T('Share in {group}', { group: g.name }))}">
    <div class="guide-h">${icon('users', 16)}<b>${T('Share in {group}', { group: esc(g.name) })}</b><span class="spacer"></span><button class="icon-btn sm" data-action="guide-close" aria-label="${T('Close')}">${icon('x', 14)}</button></div>
    <ol class="guide-steps">
      <li class="done">${icon('check', 13)} ${T('Post link copied, group opened in a new tab')}</li>
      <li>${T('In the group, click "Write something..."')}</li>
      <li>${T('Paste the link (Ctrl+V). The post preview appears.')}</li>
      <li>${T('Write a few words and click Post')}</li>
      <li>${T('Open your new group post, copy its link and submit it here')}</li>
    </ol>
    <div class="post-btns"><button class="btn sm" data-action="copy" data-text="${esc(p.fbLink)}">${icon('copy', 14)} ${T('Copy link again')}</button><a class="btn sm" href="${esc(g.url)}" target="_blank" rel="noopener">${icon('ext', 14)} ${T('Open group again')}</a><button class="btn sm primary" data-action="guide-submit" data-id="${p.id}" data-group="${g.id}">${icon('link', 14)} ${T('Submit group post link')}</button></div>
  </div>`;
  box.classList.add('open');
}
Object.assign(Actions, {
  'guide-close': () => { const b = $('#guide'); if (b) b.classList.remove('open'); },
  'guide-submit': el => { const b = $('#guide'); if (b) b.classList.remove('open'); openPost(el.dataset.id, el.dataset.group); },
});
/* ---------------- paste button (easier on phones) ---------------- */
const pasteBtn = () => `<button type="button" class="paste-btn" data-action="paste-link" title="${T('Paste')}" aria-label="${T('Paste')}">${icon('paste', 15)}<span>${T('Paste')}</span></button>`;
Actions['paste-link'] = el => {
  const inp = el.closest('.link-in').querySelector('input');
  const fail = () => { inp.focus(); toast(T('Tap the box and choose Paste (or press Ctrl+V)'), 'error'); };
  if (!navigator.clipboard || !navigator.clipboard.readText) { fail(); return; }
  navigator.clipboard.readText().then(t => {
    t = String(t || '').trim(); const m = t.match(/https?:\/\/\S+/);
    if (!m) { inp.focus(); toast(T('The copied text is not a link. Copy your post link first.'), 'error'); return; }
    inp.value = cleanLink(m[0]); inp.focus();
    if (!isFbUrl(inp.value)) toast(T('This is not a Facebook link'), 'error'); else toast(T('Link pasted. Now press Submit.'));
  }).catch(fail);
};

/* ---------------- notice from the admin ---------------- */
function noticeBanner() {
  const n = activeNotice(); if (!n || App.user.noticeSeen === n.at) return '';
  const by = userById(n.by);
  return `<div class="notice-banner">${icon('megaphone', 20)}<div class="grow"><b>${T('Notice from the admin')}</b><p>${esc(n.text).replace(/\n/g, '<br>')}</p><small>${by ? esc(by.name) + ' . ' : ''}${timeAgo(n.at)}</small></div><button class="icon-btn sm" data-action="notice-ok" title="${T('Got it')}" aria-label="${T('Got it')}">${icon('x', 14)}</button></div>`;
}
Actions['notice-ok'] = () => { const u = userById(App.user.id), n = activeNotice(); if (u && n) { u.noticeSeen = n.at; App.user = u; commit(); } };

/* ---------------- notifications ---------------- */
function notifItems() {
  const me = App.user.id, since = new Date(Date.now() - 14 * 86400000).toISOString(), out = [];
  const n = activeNotice(); if (n) out.push({ at: n.at, ic: 'megaphone', tone: 'warn', html: `<b>${T('Notice from the admin')}</b>: ${esc(n.text.slice(0, 90))}${n.text.length > 90 ? '...' : ''}`, act: 'data-action="nav" data-page="home"' });
  State.db.posts.forEach(p => {
    if (!(p.createdAt > since)) return;
    const mine = tasksFor(p).filter(t => t.userId === me); if (!mine.length) return;
    out.push({ at: p.createdAt, ic: 'file', tone: 'accent', html: T('New post to share: {post}', { post: `<b>${esc(p.title)}</b>` }) + ` <span class="muted">(${esc(mine.map(t => targetName(t.groupId)).join(', '))}${isLive(p) ? '' : ', ' + fmtDay(p.date)})</span>`, act: `data-action="open-task" data-id="${p.id}" data-group="${mine[0].groupId || ''}"` });
  });
  State.db.shares.forEach(s => {
    if (s.userId !== me || !s.checkedAt || s.checkedAt <= since || s.status === 'pending') return;
    const p = postById(s.postId); if (!p) return;
    const ok = s.status === 'verified';
    out.push({ at: s.checkedAt, ic: ok ? 'checkCircle' : 'xCircle', tone: ok ? 'success' : 'danger', html: T(ok ? 'Your {where} link for {post} was verified' : 'Your {where} link for {post} was rejected', { where: esc(targetName(s.groupId)), post: `<b>${esc(p.title)}</b>` }) + (!ok && s.note ? `<br><span class="muted">${esc(noteText(s.note))}</span>` : ''), act: `data-action="open-task" data-id="${p.id}" data-group="${s.groupId || ''}"` });
  });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
function onChange(t) {}


configureHooks({PAGES,NAV,DEFAULT_PAGE,CHIP,openPost,notifItems,onChange,CTA:typeof CTA==='undefined'?undefined:CTA,BOTTOM:typeof BOTTOM==='undefined'?[]:BOTTOM});
installCloudUI({ROLE,State,App,Forms,Actions,PAGES,render,renderPage,openPost,openModal,closeModal,toast,T,esc,icon,commit,logEvent,userById,confirmBox,normalizeDB,boot});
boot();
