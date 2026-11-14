/**
 * SVJC Reunion 2026 — upload backend (Google Apps Script).
 *
 * Runs as YOU, so every uploaded file is saved in YOUR Google Drive and uses YOUR storage.
 * Visitors never sign in: the upload page on www.svjc-mpc-93-95.in talks to this script.
 *
 * Setup (see SETUP.md):
 *   1. Paste this file and appsscript.json into a new Apps Script project.
 *   2. Run `setup` once and approve access (it creates the Drive folder).
 *   3. Deploy → New deployment → Web app: Execute as "Me", Who has access "Anyone".
 *   4. Send the Web app URL to be placed in upload/config.js.
 *
 * Privacy: the script can only see files and folders it creates itself (drive.file scope),
 * not the rest of your Drive.
 */

const ROOT_FOLDER_NAME = 'SVJC Reunion 2026 – Uploads';
const SITE_ORIGIN = 'https://www.svjc-mpc-93-95.in';   // lets the browser send pieces straight to Google
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const MAX_FILE_BYTES = 20 * 1024 * 1024 * 1024;           // 20 GB per file
const ALLOWED = /^(image|video)\//;

/** Run once from the editor: creates the uploads folder and prints its link. */
function setup() {
  const id = rootFolderId_();
  Logger.log('Uploads folder: https://drive.google.com/drive/folders/' + id);
}

function doGet() {
  return json_({ ok: true, service: 'svjc-upload' });
}

/** The page sends JSON as text/plain (no CORS preflight). */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    switch (req.action) {
      case 'init':   return json_(init_(req));
      case 'chunk':  return json_(chunk_(req));
      case 'status': return json_(status_(req));
      default:       return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/** Start a resumable upload; returns Google's one-file upload address. */
function init_(req) {
  const name = clean_(req.name, 'file').slice(0, 180);
  const type = String(req.type || '');
  const size = Number(req.size);
  if (!ALLOWED.test(type)) return { ok: false, error: 'Only photos and videos can be uploaded.' };
  if (!(size > 0) || size > MAX_FILE_BYTES) return { ok: false, error: 'File is empty or too large.' };

  const folderId = uploaderFolderId_(clean_(req.uploader, 'Guests').slice(0, 60));
  const res = UrlFetchApp.fetch(UPLOAD + '?uploadType=resumable&supportsAllDrives=true', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': type,
      'X-Upload-Content-Length': String(size),
      Origin: SITE_ORIGIN
    },
    payload: JSON.stringify({ name: name, parents: [folderId], description: 'Uploaded via svjc-mpc-93-95.in by ' + clean_(req.uploader, 'a guest') }),
    muteHttpExceptions: true
  });
  const url = header_(res, 'Location');
  if (res.getResponseCode() !== 200 || !url) return { ok: false, error: 'Could not start upload (' + res.getResponseCode() + ').' };
  if (url.indexOf(UPLOAD) !== 0) return { ok: false, error: 'Unexpected upload address.' };
  return { ok: true, url: url };
}

/** Fallback path: the page sends a piece here (base64) and the script forwards it to Google. */
function chunk_(req) {
  checkUrl_(req.url);
  const bytes = Utilities.base64Decode(req.data);
  const start = Number(req.start), total = Number(req.total), end = start + bytes.length - 1;
  const res = UrlFetchApp.fetch(req.url, {
    method: 'put',
    contentType: 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total },
    payload: bytes,
    muteHttpExceptions: true
  });
  return progress_(res);
}

/** Ask Google how much of a file has arrived (used to resume after a dropped connection). */
function status_(req) {
  checkUrl_(req.url);
  const res = UrlFetchApp.fetch(req.url, {
    method: 'put',
    headers: { 'Content-Range': 'bytes */' + Number(req.total) },
    muteHttpExceptions: true
  });
  return progress_(res);
}

/* ---------------- helpers ---------------- */

function progress_(res) {
  const code = res.getResponseCode();
  if (code === 200 || code === 201) return { ok: true, done: true };
  if (code === 308) {
    const range = header_(res, 'Range');                       // e.g. "bytes=0-8388607"
    const next = range ? Number(range.split('-')[1]) + 1 : 0;
    return { ok: true, done: false, next: next };
  }
  if (code === 404 || code === 410) return { ok: false, expired: true, error: 'Upload expired, please try again.' };
  return { ok: false, error: 'Google Drive replied ' + code };
}

function rootFolderId_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('ROOT_ID');
  if (id) return id;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    id = props.getProperty('ROOT_ID');
    if (!id) { id = createFolder_(ROOT_FOLDER_NAME, null); props.setProperty('ROOT_ID', id); }
    return id;
  } finally { lock.releaseLock(); }
}

/** One sub-folder per uploader name, e.g. "Uploads/Photographer". */
function uploaderFolderId_(who) {
  const root = rootFolderId_();
  const props = PropertiesService.getScriptProperties();
  const key = 'F_' + Utilities.base64EncodeWebSafe(who.toLowerCase()).slice(0, 200);
  let id = props.getProperty(key);
  if (id) return id;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    id = props.getProperty(key);
    if (!id) { id = createFolder_(who, root); props.setProperty(key, id); }
    return id;
  } finally { lock.releaseLock(); }
}

function createFolder_(name, parent) {
  const meta = { name: name, mimeType: 'application/vnd.google-apps.folder' };
  if (parent) meta.parents = [parent];
  const res = UrlFetchApp.fetch(DRIVE + '?fields=id', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(meta), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Could not create folder (' + res.getResponseCode() + ')');
  return JSON.parse(res.getContentText()).id;
}

function checkUrl_(u) {
  if (typeof u !== 'string' || u.indexOf(UPLOAD) !== 0 || u.indexOf('upload_id=') < 0) throw new Error('Bad upload address');
}

function header_(res, name) {
  const h = res.getAllHeaders(), want = name.toLowerCase();
  for (const k in h) if (k.toLowerCase() === want) return Array.isArray(h[k]) ? h[k][0] : h[k];
  return '';
}

function clean_(s, fallback) {
  const t = String(s || '').replace(/[\u0000-\u001f\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || fallback;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
