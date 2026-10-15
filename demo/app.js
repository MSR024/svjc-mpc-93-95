/* MPC 1993–95 Batch Map — page logic.
   Adapted from SacramentoIndians.org: organizations → classmates, categories → professions,
   sub-regions → areas, map limited to Telangana. Kept in its own file (no inline scripts)
   so the page's Content-Security-Policy can block injected code. */

/* =====================================================================
   SITE CONFIG — edit this block and classmates.json; no other code changes needed.
   ===================================================================== */
const CONFIG = {
  dataUrl: 'classmates.json',
  map: {
    center: [17.95, 79.15], zoom: 7,
    // The map can't be panned beyond Telangana (Adilabad → Nalgonda/Mahbubnagar, Nizamabad → Bhadrachalam).
    bounds: [[15.75, 77.15], [19.98, 81.40]],
    minZoom: 6.5
  },
  meet: {
    date: '2026-10-25',
    title: 'Batch Meet · MPC 1993–95',
    time: '',                                  // e.g. '10:00 AM'
    venue: 'Venue to be announced',
    timeZone: 'Asia/Kolkata'
  },
  // Classmates living outside Telangana have no pin; they are listed under this area.
  outsideArea: 'Outside Telangana',
  areas: ['Hyderabad', 'Karimnagar – Huzurabad', 'Warangal', 'Rest of Telangana', 'Outside Telangana'],
  professions: [
    { name: 'Engineering & IT',            color: '#4285F4' },  // blue
    { name: 'Medicine & Health',           color: '#EA4335' },  // red
    { name: 'Teaching & Research',         color: '#34A853' },  // green
    { name: 'Business',                    color: '#FA7B17' },  // orange
    { name: 'Government & Public Service', color: '#129EAF' },  // teal
    { name: 'Banking & Finance',           color: '#A142F4' },  // purple
    { name: 'Law',                         color: '#795548' },  // brown
    { name: 'Agriculture',                 color: '#7CB342' },  // leaf green
    { name: 'Other',                       color: '#5F6368' }   // grey
  ]
};

/* ===================== helpers ===================== */
const $ = (s) => document.querySelector(s);
const profColor = (name) => (CONFIG.professions.find(c => c.name === name) || { color: '#5F6368' }).color;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '';
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const isOutside = (p) => p.location === 'outside' || typeof p.lat !== 'number';
const byId = (id) => state.people.find(p => p.id === id);

function pinSvg(color) {
  // Dashed outline = approximate (city-level) location.
  return `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true">
    <path d="M14 1C6.8 1 1 6.8 1 14c0 9.6 13 23 13 23s13-13.4 13-23C27 6.8 21.2 1 14 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#fff"/>
  </svg>`;
}
const makeIcon = (p) => L.divIcon({ className: 'mate-pin', html: pinSvg(profColor(p.profession)), iconSize: [28, 38], iconAnchor: [14, 37], popupAnchor: [0, -34] });

// People in the same city would sit on top of each other. Spread them on a small
// sunflower spiral around the city centre (about 1–3 km) so every pin can be tapped.
function spreadPins(people) {
  const groups = new Map();
  people.filter(p => !isOutside(p)).forEach(p => {
    const k = p.lat.toFixed(3) + ',' + p.lng.toFixed(3);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  });
  groups.forEach(list => {
    if (list.length < 2) { list.forEach(p => { p._lat = p.lat; p._lng = p.lng; }); return; }
    list.forEach((p, i) => {
      const r = 0.008 * Math.sqrt(i + 0.6), a = i * 2.39996;
      p._lat = p.lat + r * Math.cos(a);
      p._lng = p.lng + r * Math.sin(a) / Math.cos(p.lat * Math.PI / 180);
    });
  });
}

function badge(p) {
  return `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style="background:${profColor(p.profession)}">${esc(p.profession)}</span>`;
}
const sampleTag = (p) => p.sample ? `<span class="ml-1 align-middle rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide px-1 py-px">sample</span>` : '';

function popupHtml(p) {
  const link = safeUrl(p.link);
  return `<div class="text-slate-800">
    <p class="font-bold text-[15px] leading-snug">${esc(p.name)}${sampleTag(p)}</p>
    <p class="text-xs text-slate-600 mb-1.5">${esc(p.work)}</p>
    <div class="mb-2">${badge(p)}</div>
    <p class="text-xs leading-snug"><span class="text-slate-500">City:</span> ${esc(p.city)}</p>
    ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer"
       class="mt-2 inline-block text-xs font-medium !text-white rounded-full px-3 py-1.5 no-underline hover:opacity-90" style="background:#8b1e2d">Profile →</a>` : ''}
  </div>`;
}

/* ===================== state ===================== */
const state = { people: [], q: '', prof: 'All', area: 'All', activeId: null };
const markers = new Map();
let map, layer, outsideCtl;

/* ===================== meet banner ===================== */
function setupBanner() {
  const m = CONFIG.meet;
  const d = new Date(m.date + 'T12:00:00+05:30');
  const fmt = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: m.timeZone, ...o }).format(d);
  $('#evDow').textContent = fmt({ weekday: 'short' });
  $('#evDay').textContent = fmt({ day: 'numeric' });
  $('#evMon').textContent = fmt({ month: 'short' });
  $('#evTitle').textContent = m.title;
  $('#evLine').textContent = [(fmt({ weekday: 'long' }) + ', ' + fmt({ day: 'numeric', month: 'long', year: 'numeric' })) + (m.time ? ', ' + m.time : ''), m.venue].filter(Boolean).join('  ·  ');
  // Countdown counted in India time.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: m.timeZone }).format(new Date());
  const days = Math.round((Date.parse(m.date) - Date.parse(today)) / 86400000);
  $('#evCountdown').textContent = days > 1 ? `In ${days} days` : days === 1 ? 'Tomorrow' : days === 0 ? 'Today!' : 'Thank you for coming!';
}

/* ===================== UI setup ===================== */
function setupChrome() {
  setupBanner();

  const openModal = (id) => { const m = document.getElementById(id); m.classList.remove('hidden'); m.classList.add('flex'); m.querySelector('input,button')?.focus(); };
  const closeModals = () => document.querySelectorAll('.modal').forEach(m => { m.classList.add('hidden'); m.classList.remove('flex'); });
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModals(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  $('#profSelect').innerHTML = CONFIG.professions.map(p => `<option>${esc(p.name)}</option>`).join('');

  // No server on GitHub Pages: the details are sent to the batch over WhatsApp, or copied.
  $('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, status = $('#addStatus'), data = new FormData(f);
    if (!f.checkValidity()) {
      status.className = 'text-xs text-center text-red-600';
      status.textContent = 'Please fill in your name and city, and tick the consent box.';
      return;
    }
    const text = ['MPC 1993–95 batch map: please add / update me',
      'Name: ' + data.get('name'), 'Profession: ' + data.get('profession'),
      data.get('work') ? 'Work: ' + data.get('work') : '', 'City: ' + data.get('city'),
      data.get('notes') ? 'Notes: ' + data.get('notes') : '', 'I agree to my name, profession and city being shown on the batch map.']
      .filter(Boolean).join('\n');
    if ((e.submitter && e.submitter.dataset.via) === 'copy') {
      try { await navigator.clipboard.writeText(text); status.className = 'text-xs text-center text-emerald-600'; status.textContent = 'Copied! Paste it in the batch WhatsApp group.'; }
      catch { status.className = 'text-xs text-center text-red-600'; status.textContent = 'Could not copy. Please use “Send on WhatsApp”.'; }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      status.className = 'text-xs text-center text-emerald-600'; status.textContent = 'Choose the batch group in WhatsApp and send. Thank you!';
    }
  });

  renderPills();
  $('#pills').addEventListener('click', (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    state.prof = b.dataset.cat; paintPills(); render(true);
  });

  let t;
  const syncClear = () => { $('#searchClear').hidden = !$('#search').value; };
  $('#search').addEventListener('input', (e) => {
    syncClear(); clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 80);
  });
  $('#searchClear').addEventListener('click', () => { $('#search').value = ''; state.q = ''; syncClear(); render(); $('#search').focus(); });
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); $('#searchClear').click(); }
  });
  $('#area').addEventListener('change', (e) => { state.area = e.target.value; render(true); });

  $('#toggleSidebar').addEventListener('click', () => {
    const c = $('#app').classList.toggle('collapsed');
    $('#toggleIcon').setAttribute('d', c ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6');
    $('#toggleSidebar').setAttribute('aria-label', c ? 'Expand directory' : 'Collapse directory');
    setTimeout(() => map.invalidateSize(), 260);
  });
  $('#drawerHandle').addEventListener('click', () => setDrawer(!$('#app').classList.contains('drawer-open')));
  let y0 = null;
  ['#drawerHandle', '#drawerHead'].forEach(sel => {
    $(sel).addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    $(sel).addEventListener('touchend', (e) => {
      if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
      if (dy < -40) setDrawer(true); else if (dy > 40) setDrawer(false);
    }, { passive: true });
  });
  $('#legendToggle').addEventListener('click', () => {
    if (!isMobile()) return;
    const open = $('#legend').classList.toggle('open');
    $('#legendToggle').setAttribute('aria-expanded', String(open));
    $('#legendToggleIcon').textContent = open ? '▴' : '▾';
  });
  $('#search').addEventListener('focus', () => { if (isMobile()) setDrawer(true); });
}

// Only professions that have at least one person are shown.
const usedProfs = () => state.people.length
  ? CONFIG.professions.filter(c => state.people.some(p => p.profession === c.name))
  : CONFIG.professions;

function renderPills() {
  const defs = [{ name: 'All', color: '#8b1e2d' }, ...usedProfs()];
  $('#pills').innerHTML = defs.map(p => `
    <button type="button" class="pill text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-700 px-3 py-1.5 hover:bg-slate-100 transition"
            data-cat="${esc(p.name)}" data-color="${p.color}" aria-pressed="${p.name === state.prof}">${esc(p.name)}</button>`).join('');
  paintPills();
}
function paintPills() {
  document.querySelectorAll('.pill').forEach(b => {
    const on = b.dataset.cat === state.prof;
    b.setAttribute('aria-pressed', on);
    b.style.background = on ? b.dataset.color : '';
  });
}
function renderLegend() {
  $('#legendList').innerHTML = usedProfs().map(c =>
    `<li class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${c.color}"></span>${esc(c.name)}</li>`).join('');
}
function populateAreas() {
  const fromData = state.people.map(p => p.area).filter(Boolean);
  const areas = [...new Set([...CONFIG.areas, ...fromData])];
  const n = (a) => state.people.filter(p => p.area === a).length;
  $('#area').innerHTML = `<option value="All">All areas (${state.people.length})</option>` +
    areas.map(a => `<option value="${esc(a)}">${esc(a)} (${n(a)})</option>`).join('');
}

function setDrawer(open) {
  $('#app').classList.toggle('drawer-open', open);
  $('#drawerHandle').setAttribute('aria-expanded', String(open));
  updatePeek();
}
function updatePeek() {
  const open = $('#app').classList.contains('drawer-open');
  $('#peekText').textContent = open ? 'Show map ▼' : `Browse ${state.people.filter(matches).length} classmates ▲`;
}

/* ===================== map ===================== */
function setupMap() {
  const bounds = L.latLngBounds(CONFIG.map.bounds);
  map = L.map('map', { zoomSnap: 0.5, zoomControl: false, minZoom: CONFIG.map.minZoom, maxBounds: bounds, maxBoundsViscosity: 1.0 })
    .setView(CONFIG.map.center, CONFIG.map.zoom);
  map.setMinZoom(Math.max(CONFIG.map.minZoom, map.getBoundsZoom(bounds, false) - 0.5));
  L.control.zoom({ position: 'topright' }).addTo(map);
  map.on('click', () => { if (isMobile()) setDrawer(false); });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  layer = L.layerGroup().addTo(map);

  // "N outside Telangana" button on the map: filters the list to them.
  outsideCtl = L.control({ position: 'topright' });
  outsideCtl.onAdd = () => {
    const b = L.DomUtil.create('button', 'outside-ctl rounded-full bg-white/95 text-slate-800 text-xs font-semibold shadow-md border border-slate-200 px-3 py-1.5 hover:bg-amber-50');
    b.type = 'button';
    L.DomEvent.disableClickPropagation(b);
    b.addEventListener('click', () => {
      state.area = CONFIG.outsideArea; $('#area').value = state.area; render();
      if (isMobile()) setDrawer(true);
    });
    return b;
  };
  outsideCtl.addTo(map);

  spreadPins(state.people);
  state.people.forEach(p => {
    if (isOutside(p)) return;
    const m = L.marker([p._lat, p._lng], { icon: makeIcon(p), title: p.name, riseOnHover: true, keyboard: true })
      .bindPopup(popupHtml(p), { maxWidth: 260, autoPanPaddingTopLeft: [20, 20], autoPanPaddingBottomRight: isMobile() ? [20, 170] : [20, 20] });
    m.on('mouseover', () => { if (!m.isPopupOpen()) m.openPopup(); });
    m.on('popupopen', () => setActive(p.id, false));
    markers.set(p.id, m);
  });
}

/* ===================== filtering & rendering ===================== */
function matches(p) {
  if (state.prof !== 'All' && p.profession !== state.prof) return false;
  if (state.area !== 'All' && p.area !== state.area) return false;
  if (!state.q) return true;
  const hay = [p.name, p.profession, p.work, p.city, p.area].join(' ').toLowerCase();
  return state.q.split(/\s+/).every(t => hay.includes(t));
}

function render(fit = false) {
  const visible = state.people.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
  layer.clearLayers();
  visible.forEach(p => markers.get(p.id)?.addTo(layer));

  const outN = visible.filter(isOutside).length;
  const ctl = outsideCtl.getContainer();
  ctl.textContent = `✈ ${outN} outside Telangana`;
  ctl.style.display = outN && state.area !== CONFIG.outsideArea ? '' : 'none';

  $('#count').textContent = `${visible.length} of ${state.people.length} classmates`;
  updatePeek();
  $('#list').innerHTML = visible.length ? visible.map(cardHtml).join('') :
    `<li class="text-sm text-slate-500 text-center py-10">No classmates match.<br><button type="button" id="reset" class="mt-2 text-brand-600 font-medium hover:underline">Clear filters</button></li>`;
  $('#reset')?.addEventListener('click', resetFilters);

  const pts = visible.filter(p => !isOutside(p)).map(p => [p._lat, p._lng]);
  if (fit && pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 11, duration: 0.6 });
}

function cardHtml(p) {
  const c = profColor(p.profession), out = isOutside(p);
  const link = safeUrl(p.link);
  return `<li>
    <article class="card rounded-lg border border-slate-200 bg-white px-3 py-2 ${out ? '' : 'cursor-pointer'} hover:shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] transition ${state.activeId === p.id ? 'is-active' : ''}"
             style="--c:${c}; border-left:4px solid ${c}" data-id="${esc(p.id)}" ${out ? '' : `tabindex="0" role="button" aria-label="Show ${esc(p.name)} on map"`}>
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="font-semibold text-sm leading-snug">${esc(p.name)}${sampleTag(p)}</h2>
          <p class="text-[11.5px] text-slate-600 truncate">${esc(p.work)}</p>
        </div>
        ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" data-site
           class="shrink-0 text-[11px] font-medium rounded-full border border-slate-200 px-2.5 py-1 text-brand-600 hover:bg-brand-50 transition">Profile ↗</a>` : ''}
      </div>
      <div class="mt-1 flex items-center gap-1.5 min-w-0">
        ${state.prof === 'All' ? `<span class="shrink-0">${badge(p)}</span>` : ''}
        <p class="min-w-0 text-[11px] text-slate-500 truncate">${out ? '✈ ' : '📍 '}${esc(p.city)}</p>
      </div>
    </article>
  </li>`;
}

function focusPerson(id) {
  const p = byId(id), m = markers.get(id);
  if (!p || !m) return;
  if (isMobile()) setDrawer(false);
  map.flyTo([p._lat, p._lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
  map.once('moveend', () => m.openPopup());
}

function setActive(id, scroll = true) {
  state.activeId = id;
  document.querySelectorAll('.card.is-active').forEach(el => el.classList.remove('is-active'));
  document.querySelectorAll('.mate-pin.is-active').forEach(el => el.classList.remove('is-active'));
  const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (card) { card.classList.add('is-active'); if (scroll && !isMobile()) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  markers.get(id)?.getElement()?.classList.add('is-active');
}

function resetFilters() {
  state.q = ''; state.prof = 'All'; state.area = 'All';
  $('#search').value = ''; $('#searchClear').hidden = true; $('#area').value = 'All';
  paintPills(); render(true);
}

$('#list').addEventListener('click', (e) => {
  if (e.target.closest('[data-site]')) return;
  const card = e.target.closest('.card'); if (!card || !markers.has(card.dataset.id)) return;
  setActive(card.dataset.id, false); focusPerson(card.dataset.id);
});
$('#list').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) {
    e.preventDefault(); setActive(e.target.dataset.id, false); focusPerson(e.target.dataset.id);
  }
});

/* ===================== boot ===================== */
(async function init() {
  setupChrome();
  try {
    const res = await fetch(CONFIG.dataUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.people = await res.json();
  } catch (err) {
    $('#list').innerHTML = `<li class="text-sm text-red-600 p-4">Could not load the classmates list. Please refresh the page.</li>`;
    console.error(err);
    setupMap();
    return;
  }
  populateAreas();
  renderPills();
  renderLegend();
  setupMap();
  render();
  fitAll();
})();

// Opening view: frame every pin, leaving room for the phone drawer at the bottom.
function fitAll() {
  const pts = state.people.filter(p => !isOutside(p)).map(p => [p._lat, p._lng]);
  if (!pts.length) return;
  map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [20, isMobile() ? 60 : 20], paddingBottomRight: [20, isMobile() ? 160 : 20], maxZoom: 10 });
}
