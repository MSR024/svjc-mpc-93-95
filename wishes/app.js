/* Wish your Friend — birthdays & wedding anniversaries of the MPC 1993–95 batch.
   Data: the same friends list as the directory (../friends/classmates.json). Each friend may have
     "birthday":    "MM-DD"   e.g. "03-12" for 12 March   (day and month only — never the year)
     "anniversary": "MM-DD"
     "whatsapp":    "919876543210"  (optional, only with that friend's consent: opens a chat with them)
   "Today" is worked out in India time, since most of the batch is in Telangana. */
(function () {
  'use strict';
  const DATA_URL = '../friends/classmates.json';
  const TZ = 'Asia/Kolkata';
  const SIGN = 'From your MPC 1993–95 friends, Shathavahana Junior College';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const state = { events: [], filter: 'all', year: 0, month: 0, selDay: null, today: null };

  /* ---------- dates (all as plain Y/M/D in India time, no clock maths across zones) ---------- */
  function todayIST() {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date()).split('-').map(Number);
    return { y, m, d };
  }
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();          // m: 1–12
  const dowMon0 = (y, m, d) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;   // Mon=0
  const addDays = (o, n) => { const t = new Date(Date.UTC(o.y, o.m - 1, o.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  // 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
  const dayFor = (ev, y) => (ev.m === 2 && ev.d === 29 && !isLeap(y)) ? 28 : ev.d;

  function parseMD(s) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const mo = +m[1], d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > (mo === 2 ? 29 : daysIn(2001, mo))) return null;
    return { m: mo, d };
  }

  const shown = () => state.events.filter(e => state.filter === 'all' || e.type === state.filter);
  const on = (y, m, d) => shown().filter(e => e.m === m && dayFor(e, y) === d)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'bday' ? -1 : 1));

  /* ---------- rendering ---------- */
  const waIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z"/></svg>';

  function itemHtml(e, y, label) {
    const d = dayFor(e, y);
    const what = e.type === 'bday' ? '🎂 <b>Birthday</b>' : '💍 <b>Wedding anniversary</b>';
    return `<li class="item ${e.type}">
      <div class="dbox"><div class="m">${MONTHS[e.m - 1].slice(0, 3)}</div><div class="d">${d}</div></div>
      <div class="who"><p class="n">${esc(e.name)}</p><p class="t">${what}${label ? ' · ' + esc(label) : ''}</p></div>
      <button type="button" class="wish" data-id="${esc(e.id)}" data-type="${e.type}" aria-label="Send wishes to ${esc(e.name)} on WhatsApp">${waIcon}<span class="lbl">Wish</span></button>
    </li>`;
  }

  function emptyHtml(text) { return `<li class="empty"><span class="big">🌼</span>${text}</li>`; }

  function renderToday() {
    const t = state.today, list = on(t.y, t.m, t.d);
    $('#today').hidden = !list.length;
    $('#todayList').innerHTML = list.map(e => itemHtml(e, t.y, '')).join('');
  }

  function renderWeek() {
    const t = state.today, rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(t, i);
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DOW[dowMon0(day.y, day.m, day.d)] + ' ' + day.d + ' ' + MONTHS[day.m - 1].slice(0, 3);
      on(day.y, day.m, day.d).forEach(e => rows.push(itemHtml(e, day.y, label)));
    }
    $('#weekCount').textContent = rows.length ? rows.length : '';
    $('#weekList').innerHTML = rows.length ? rows.join('') :
      emptyHtml(state.events.length ? 'No birthdays or anniversaries in the next 7 days.' : 'No dates added yet. Be the first to add yours below!');
  }

  function renderCalendar() {
    const { year: y, month: m, today: t } = state;
    $('#calTitle').textContent = MONTHS[m - 1] + ' ' + y;
    let html = DOW.map(d => `<div class="dow" role="columnheader">${d.slice(0, 2)}</div>`).join('');
    const lead = dowMon0(y, m, 1), n = daysIn(y, m);
    for (let i = 0; i < lead; i++) html += '<div class="day out" aria-hidden="true"></div>';
    for (let d = 1; d <= n; d++) {
      const evs = on(y, m, d);
      const b = evs.some(e => e.type === 'bday'), a = evs.some(e => e.type === 'anniv');
      const cls = ['day', evs.length ? 'has' : '', (y === t.y && m === t.m && d === t.d) ? 'today' : '', state.selDay === d ? 'sel' : ''].join(' ');
      const lbl = `${d} ${MONTHS[m - 1]}${evs.length ? ': ' + evs.map(e => e.name + (e.type === 'bday' ? ' birthday' : ' anniversary')).join(', ') : ''}`;
      html += evs.length
        ? `<button type="button" class="${cls}" data-day="${d}" aria-label="${esc(lbl)}" aria-pressed="${state.selDay === d}"><span>${d}</span><span class="dots">${b ? '<i class="b"></i>' : ''}${a ? '<i class="a"></i>' : ''}</span></button>`
        : `<div class="${cls}" aria-label="${esc(lbl)}"><span>${d}</span><span class="dots"></span></div>`;
    }
    $('#cal').innerHTML = html;
    renderDayList();
  }

  // Under the calendar: the selected day, or everyone in the shown month.
  function renderDayList() {
    const { year: y, month: m } = state;
    let title, rows = [];
    if (state.selDay) {
      title = state.selDay + ' ' + MONTHS[m - 1];
      rows = on(y, m, state.selDay).map(e => itemHtml(e, y, ''));
    } else {
      title = 'All in ' + MONTHS[m - 1];
      for (let d = 1; d <= daysIn(y, m); d++) on(y, m, d).forEach(e => rows.push(itemHtml(e, y, '')));
    }
    $('#dayList').innerHTML = `<p class="daytitle">${esc(title)}${rows.length ? ` · ${rows.length}` : ''}</p>` +
      `<ul class="list">${rows.length ? rows.join('') : emptyHtml('Nothing this ' + (state.selDay ? 'day' : 'month') + ' yet.')}</ul>`;
  }

  function renderAll() { renderToday(); renderWeek(); renderCalendar(); }

  /* ---------- wishing ---------- */
  function message(e) {
    return e.type === 'bday'
      ? `Happy Birthday, ${e.name}! 🎂🎉\nWishing you good health, happiness and a wonderful year ahead.\n— ${SIGN}`
      : `Happy Wedding Anniversary, ${e.name}! 💍🎉\nWishing you both many more years of love and togetherness.\n— ${SIGN}`;
  }
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.wish');
    if (btn) {
      const e = state.events.find(x => x.id === btn.dataset.id && x.type === btn.dataset.type);
      if (!e) return;
      const num = /^\d{10,15}$/.test(e.whatsapp || '') ? e.whatsapp : '';
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(message(e))}`, '_blank', 'noopener');
      toast(num ? 'Opening WhatsApp…' : 'Pick the friend or the batch group in WhatsApp');
      return;
    }
    const day = ev.target.closest('.day[data-day]');
    if (day) { const d = +day.dataset.day; state.selDay = state.selDay === d ? null : d; renderCalendar(); return; }
    const chip = ev.target.closest('.chip');
    if (chip) {
      state.filter = chip.dataset.f;
      document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      renderAll();
    }
  });
  $('#prev').addEventListener('click', () => { state.month--; if (state.month < 1) { state.month = 12; state.year--; } state.selDay = null; renderCalendar(); });
  $('#next').addEventListener('click', () => { state.month++; if (state.month > 12) { state.month = 1; state.year++; } state.selDay = null; renderCalendar(); });

  /* ---------- boot ---------- */
  (async function init() {
    state.today = todayIST();
    state.year = state.today.y; state.month = state.today.m;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const people = await res.json();
      people.forEach(p => {
        const b = parseMD(p.birthday), a = parseMD(p.anniversary);
        if (b) state.events.push({ id: p.id, name: p.name, type: 'bday', m: b.m, d: b.d, whatsapp: p.whatsapp });
        if (a) state.events.push({ id: p.id, name: p.name, type: 'anniv', m: a.m, d: a.d, whatsapp: p.whatsapp });
      });
    } catch (err) {
      console.error(err);
      $('#weekList').innerHTML = emptyHtml('Could not load the list. Please refresh the page.');
    }
    renderAll();
  })();
})();
