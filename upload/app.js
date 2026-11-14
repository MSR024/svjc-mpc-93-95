/* Reunion upload page: sends photos & videos to the organizers' Google Drive, no login.
   How it works:
   1. For each file, ask our Apps Script (runs as the Drive owner) to open an upload on Google Drive.
   2. Send the file in pieces straight to Google. If the browser blocks that, send each piece
      through the Apps Script instead (slower, but always works).
   3. If a piece fails (weak signal), wait, ask Google how much arrived, and carry on from there. */
(function () {
  'use strict';
  const CFG = window.UPLOAD_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const DIRECT_CHUNK = 8 * 1024 * 1024;   // must be a multiple of 256 KB
  const PROXY_CHUNK = 4 * 1024 * 1024;    // smaller: travels as text through Apps Script
  const PARALLEL = 2;                      // files at a time
  const MAX_TRIES = 8;

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CFG.SCRIPT_URL || '')) {
    $('#uploader').hidden = true; $('#closed').hidden = false; return;
  }

  const items = [];           // { file, el, state: 'queued'|'uploading'|'done'|'failed', sent, url, next }
  let directOk = true;        // switches off for the session if the browser blocks direct upload
  let running = 0, wakeLock = null;

  /* ---------- helpers ---------- */
  const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  async function callScript(body) {
    const res = await fetch(CFG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(body) });   // text/plain: no preflight
    if (!res.ok) throw new Error('Server ' + res.status);
    return res.json();
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function guessType(f) {
    // Browsers often give camera RAW / some videos a blank or generic type: use the extension then.
    if (f.type && f.type !== 'application/octet-stream') return f.type;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    return ({ orf:'image/x-olympus-orf', rw2:'image/x-panasonic-rw2', tif:'image/tiff', tiff:'image/tiff',
              jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', heic:'image/heic', heif:'image/heif', webp:'image/webp', gif:'image/gif',
              cr2:'image/x-canon-cr2', cr3:'image/x-canon-cr3', nef:'image/x-nikon-nef', arw:'image/x-sony-arw', dng:'image/x-adobe-dng', raf:'image/x-fuji-raf',
              mp4:'video/mp4', mov:'video/quicktime', m4v:'video/x-m4v', avi:'video/x-msvideo', mkv:'video/x-matroska', mts:'video/mp2t', m2ts:'video/mp2t', '3gp':'video/3gpp', webm:'video/webm', mpg:'video/mpeg', mpeg:'video/mpeg' })[ext] || f.type || '';
  }

  /* ---------- UI ---------- */
  function addFiles(list) {
    const who = $('#who').value.trim();
    for (const file of list) {
      const type = guessType(file);
      const li = document.createElement('li');
      const isImg = /^image\/(jpeg|png|webp|gif)$/.test(type) && file.size < 25e6;
      li.innerHTML = `<div class="thumb">${isImg ? '' : esc((file.name.split('.').pop() || '').slice(0, 4).toUpperCase())}</div>
        <div style="min-width:0"><p class="fname">${esc(file.name)}</p><p class="fmeta">${fmt(file.size)} · waiting</p></div>
        <span class="state">…</span><div class="bar"><i></i></div>`;
      if (isImg) { const u = URL.createObjectURL(file); li.querySelector('.thumb').style.backgroundImage = `url("${u}")`; }
      $('#files').appendChild(li);
      const it = { file, type, who, el: li, state: 'queued', sent: 0, url: null };
      if (!/^(image|video)\//.test(type)) { it.state = 'skipped'; setMeta(it, fmt(file.size) + ' · not a photo or video', true); setState(it, 'Skipped', 'err'); }
      items.push(it);
    }
    $('#summary').style.display = 'block';
    $('#pickText').textContent = 'Add more photos & videos';
    refresh(); pump();
  }

  function setMeta(it, text, err) { const m = it.el.querySelector('.fmeta'); m.textContent = text; m.classList.toggle('err', !!err); }
  function setState(it, text, cls) { const s = it.el.querySelector('.state'); s.textContent = text; s.className = 'state' + (cls ? ' ' + cls : ''); }
  function setBar(it) { it.el.querySelector('.bar > i').style.width = (it.file.size ? Math.round(100 * it.sent / it.file.size) : 100) + '%'; }
  function setFailed(it, why) { it.state = 'failed'; setMeta(it, fmt(it.file.size) + ' · ' + why, true); setState(it, 'Failed', 'err'); }

  function refresh() {
    const real = items.filter(i => i.state !== 'skipped');
    const total = real.reduce((a, i) => a + i.file.size, 0), sent = real.reduce((a, i) => a + i.sent, 0);
    const done = real.filter(i => i.state === 'done').length, failed = real.filter(i => i.state === 'failed').length;
    const busy = real.some(i => i.state === 'queued' || i.state === 'uploading');
    $('#summaryText').textContent = busy
      ? `Uploading ${done} of ${real.length} done · ${fmt(sent)} of ${fmt(total)} — please keep this page open`
      : `${done} of ${real.length} uploaded${failed ? ` · ${failed} failed` : ''}`;
    $('#totalBar').style.width = (total ? Math.round(100 * sent / total) : 0) + '%';
    $('#retry').style.display = !busy && failed ? 'block' : 'none';
    const n = $('#notice');
    if (!busy && real.length && !failed) { n.hidden = false; n.className = 'notice ok'; n.textContent = 'All done — thank you! You can close this page or add more.'; }
    else if (busy) { n.hidden = false; n.className = 'notice'; n.textContent = 'Keep this page open and your screen on until every file shows ✓. Large videos can take a while.'; }
    else n.hidden = true;
    busy ? keepAwake() : letSleep();
  }

  /* ---------- upload engine ---------- */
  function pump() {
    while (running < PARALLEL) {
      const it = items.find(i => i.state === 'queued');
      if (!it) break;
      running++; it.state = 'uploading';
      uploadOne(it).catch(err => setFailed(it, err.message || 'Upload failed'))
        .finally(() => { running--; refresh(); pump(); });
    }
    refresh();
  }

  async function uploadOne(it) {
    setState(it, '0%'); setMeta(it, fmt(it.file.size) + ' · starting');
    if (!it.url) {
      const r = await withRetry(() => callScript({ action: 'init', name: it.file.name, type: it.type, size: it.file.size, uploader: it.who }));
      if (!r.ok) throw new Error(r.error || 'Could not start');
      it.url = r.url; it.sent = 0;
    }
    let tries = 0;
    while (it.sent < it.file.size) {
      try {
        const res = directOk ? await sendDirect(it) : await sendViaScript(it);
        if (res.done) { it.sent = it.file.size; break; }
        it.sent = res.next; tries = 0;
        setBar(it); setState(it, Math.floor(100 * it.sent / it.file.size) + '%');
        setMeta(it, `${fmt(it.file.size)} · ${fmt(it.sent)} sent`); refresh();
      } catch (err) {
        if (err.expired) { it.url = null; it.sent = 0; throw new Error('Upload expired — tap Retry'); }
        if (++tries > MAX_TRIES) throw new Error('Connection problem — tap Retry');
        setMeta(it, `${fmt(it.file.size)} · weak connection, retrying…`);
        await sleep(Math.min(30000, 1500 * 2 ** (tries - 1)));
        let s = null;
        try { s = await callScript({ action: 'status', url: it.url, total: it.file.size }); } catch (_) {}   // how much arrived?
        if (s && s.ok && s.done) { it.sent = it.file.size; break; }
        if (s && s.ok) it.sent = s.next;
        if (s && s.expired) { it.url = null; it.sent = 0; throw new Error('Upload expired — tap Retry'); }
      }
    }
    it.state = 'done'; it.sent = it.file.size; setBar(it);
    setState(it, '✓', 'ok'); setMeta(it, fmt(it.file.size) + ' · uploaded');
  }

  // Straight to Google's upload address (fast). Pieces must be multiples of 256 KB except the last.
  async function sendDirect(it) {
    const end = Math.min(it.sent + DIRECT_CHUNK, it.file.size);
    let res;
    try {
      res = await fetch(it.url, { method: 'PUT', headers: { 'Content-Range': `bytes ${it.sent}-${end - 1}/${it.file.size}` }, body: it.file.slice(it.sent, end) });
    } catch (e) {
      // Blocked by the browser (or offline). First failure on the very first piece: assume blocked and switch route.
      if (it.sent === 0 && navigator.onLine !== false) { directOk = false; return sendViaScript(it); }
      throw e;
    }
    if (res.status === 200 || res.status === 201) return { done: true };
    if (res.status === 308) return { done: false, next: end };
    if (res.status === 404 || res.status === 410) { const e = new Error('expired'); e.expired = true; throw e; }
    throw new Error('Google replied ' + res.status);
  }

  // Through Apps Script (always allowed, slower).
  async function sendViaScript(it) {
    const end = Math.min(it.sent + PROXY_CHUNK, it.file.size);
    const data = await blobToBase64(it.file.slice(it.sent, end));
    const r = await callScript({ action: 'chunk', url: it.url, start: it.sent, total: it.file.size, data });
    if (!r.ok) { const e = new Error(r.error || 'Upload error'); e.expired = !!r.expired; throw e; }
    return r.done ? { done: true } : { done: false, next: r.next };
  }

  async function withRetry(fn) {
    for (let t = 1; ; t++) {
      try { return await fn(); } catch (e) { if (t >= 4) throw new Error('Could not reach the server — check your internet'); await sleep(1500 * t); }
    }
  }

  /* ---------- keep the phone awake while uploading ---------- */
  async function keepAwake() { try { if (!wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (_) {} }
  function letSleep() { try { wakeLock && wakeLock.release(); } catch (_) {} wakeLock = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && items.some(i => i.state === 'uploading')) keepAwake(); });
  window.addEventListener('beforeunload', (e) => { if (items.some(i => i.state === 'uploading' || i.state === 'queued')) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- wire up ---------- */
  $('#files-input').addEventListener('change', (e) => { if (e.target.files.length) addFiles([...e.target.files]); e.target.value = ''; });
  const pick = $('#pick');
  ['dragenter', 'dragover'].forEach(t => pick.addEventListener(t, (e) => { e.preventDefault(); pick.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => pick.addEventListener(t, (e) => { e.preventDefault(); pick.classList.remove('drag'); }));
  pick.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
  $('#retry').addEventListener('click', () => { items.filter(i => i.state === 'failed').forEach(i => { i.state = 'queued'; setState(i, '…', ''); }); pump(); });
  try { const saved = localStorage.getItem('uploader-name'); if (saved) $('#who').value = saved; } catch (_) {}
  $('#who').addEventListener('change', (e) => { try { localStorage.setItem('uploader-name', e.target.value.trim()); } catch (_) {} });
})();
