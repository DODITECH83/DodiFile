'use strict';
/* DodiFile PWA – interfaccia, archivio locale (IndexedDB), OCR locale (Tesseract.js), PDF (pdf.js). Nessun server. */

const DEV = { name: 'Adry Doditech', github: 'https://github.com/AdryDoditech/DodiFile' }; // ← cambia il link GitHub qui
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U_ICON = { over: '⚠️', soon: '⏰', later: '✅', none: 'ℹ️' };

let docs = [], query = '', filterCat = null;

/* ---------- Archivio locale: IndexedDB ---------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('dodifile', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function store(mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction('docs', mode);
    const rq = fn(t.objectStore('docs'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
}
const dbAll = () => store('readonly', s => s.getAll());
const dbPut = d => store('readwrite', s => s.put(d));
const dbDel = id => store('readwrite', s => s.delete(id));
const buildSearch = d => norm(`${d.title} ${CATS[d.cat].label} ${d.note || ''} ${d.text || ''}`);

/* ---------- Impostazioni ---------- */
const prefs = {
  get scale() { try { return +localStorage.getItem('scale') || 1; } catch { return 1; } },
  get theme() { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* modalità privata */ } applyPrefs(); }
};
function applyPrefs() {
  document.documentElement.style.fontSize = (112.5 * prefs.scale) + '%';
  const t = prefs.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
}

/* ---------- Utilità UI ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4500);
}
function openDialog(d) { if (!d.open) d.showModal(); }
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d && d.id !== 'busy') d.close(); }));
$('#busy').addEventListener('cancel', e => e.preventDefault());
const dueChip = (iso_) => { const dl = daysLeft(iso_), u = urgency(dl); return `<span class="due ${u}">${U_ICON[u]} ${dayText(dl)}</span>`; };

/* ---------- Home ---------- */
function render() {
  const today = startOfToday();
  const levels = docs.map(d => urgency(d.due ? daysLeft(d.due, today) : null));
  const count = k => levels.filter(l => l === k).length;
  const [o, s, l] = [count('over'), count('soon'), count('later')];

  $('#summary').innerHTML = (o + s + l > 0 && !query) ? `
    <div class="summary"><h2>Le tue scadenze</h2><div class="tiles">
      <div class="tile over" aria-label="Scadute: ${o}"><div aria-hidden="true">⚠️</div><div class="n">${o}</div><small>Scadute</small></div>
      <div class="tile soon" aria-label="Entro 7 giorni: ${s}"><div aria-hidden="true">⏰</div><div class="n">${s}</div><small>Entro 7 giorni</small></div>
      <div class="tile later" aria-label="Più avanti: ${l}"><div aria-hidden="true">✅</div><div class="n">${l}</div><small>Più avanti</small></div>
    </div></div>` : '';

  $('#chips').innerHTML = docs.length ? [`<button class="chip-btn" data-cat="" aria-pressed="${!filterCat}">Tutti</button>`,
    ...Object.entries(CATS).map(([k, c]) => `<button class="chip-btn" data-cat="${k}" aria-pressed="${filterCat === k}">${c.icon} ${c.label}</button>`)].join('') : '';

  let shown = filterCat ? docs.filter(d => d.cat === filterCat) : docs;
  if (query.trim()) shown = rank(shown, query);
  $('#list').innerHTML = shown.map(d => `
    <li><button class="card" data-id="${d.id}">
      <span class="thumb" aria-hidden="true">${d.thumb ? `<img src="${d.thumb}" alt="">` : CATS[d.cat].icon}</span>
      <span class="txt"><b>${esc(d.title)}</b><small>${CATS[d.cat].icon} ${CATS[d.cat].label}</small>${d.due ? dueChip(d.due) : ''}</span>
    </button></li>`).join('');

  const filtering = query.trim() || filterCat;
  $('#empty').innerHTML = shown.length ? '' : `<div class="empty"><div class="big" aria-hidden="true">${filtering ? '🔍' : '🗄️'}</div>
    <h2>${filtering ? 'Nessun documento trovato' : 'Il tuo cassetto è vuoto'}</h2>
    <p>${filtering ? 'Prova con un’altra parola o togli il filtro.' : 'Tocca il grande pulsante in alto per aggiungere la tua prima bolletta, scontrino o garanzia.'}</p></div>`;
  $('#btnClear').hidden = !query;
}

async function reload() {
  docs = (await dbAll()).sort((a, b) => b.created - a.created);
  render();
}

$('#q').addEventListener('input', e => { query = e.target.value; render(); });
$('#btnClear').addEventListener('click', () => { query = ''; $('#q').value = ''; render(); $('#q').focus(); });
$('#chips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { filterCat = b.dataset.cat || null; render(); } });
$('#list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) openDetail(+b.dataset.id); });
$('#btnScan').addEventListener('click', () => openDialog($('#sheet')));
$('#sheetClose').addEventListener('click', () => $('#sheet').close());
$('#optCam').addEventListener('click', () => { $('#sheet').close(); $('#fileCam').click(); });
$('#optFile').addEventListener('click', () => { $('#sheet').close(); $('#fileAny').click(); });
$('#btnSettings').addEventListener('click', () => openSettings(false));
$('#btnDev').addEventListener('click', () => openSettings(true));
for (const id of ['#fileCam', '#fileAny']) $(id).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });

/* ---------- OCR locale ---------- */
const loaded = {};
const loadScript = url => loaded[url] || (loaded[url] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = url; s.onload = res;
  s.onerror = () => { delete loaded[url]; rej(new Error('Impossibile caricare ' + url)); };
  document.head.appendChild(s);
}));

async function shrink(blob, max = 1800) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  } catch { return blob; }
}
async function ocrBlob(blob) {
  await loadScript(TESS);
  const w = await Tesseract.createWorker('ita');
  try { return (await w.recognize(blob)).data.text || ''; } finally { await w.terminate(); }
}
async function pdfText(file) {
  await loadScript(PDFJS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let t = tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('');
    if (t.replace(/\s/g, '').length < 30) { // PDF-immagine: lo disegno e lo leggo con l'OCR
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      t = await ocrBlob(await new Promise(r => c.toBlob(r, 'image/png')));
    }
    out += t + '\n';
  }
  return out;
}

async function importFile(file) {
  $('#busyMsg').textContent = 'Sto leggendo il documento…';
  openDialog($('#busy'));
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const blob = isPdf ? file : await shrink(file);
    let text = '';
    try { text = isPdf ? await pdfText(file) : await ocrBlob(blob); }
    catch (err) { console.warn(err); toast('Lettura automatica non disponibile (serve internet la prima volta). Salvato: controlla tu titolo e scadenza.'); }
    const a = analyze(text);
    const rec = {
      title: a.title, cat: a.cat, due: a.due?.date || null, dueLabel: a.due?.label || null,
      text, note: '', created: Date.now(), mime: isPdf ? 'application/pdf' : (blob.type || 'image/jpeg'), blob,
      thumb: null
    };
    rec.search = buildSearch(rec);
    if (!isPdf) rec.thumb = await new Promise(r => { const fr = new FileReader(); shrink(blob, 160).then(b => { fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); });
    const id = await dbPut(rec);
    await reload();
    $('#busy').close();
    openDetail(id, true);
  } catch (err) {
    console.error(err); $('#busy').close(); toast('Non sono riuscito a salvare il documento. Riprova.');
  }
}

/* ---------- Dettaglio ---------- */
async function openDetail(id, fresh = false) {
  const d = docs.find(x => x.id === id); if (!d) return;
  let draft = { ...d };
  const dlg = $('#detail');
  const url = URL.createObjectURL(d.blob);
  dlg.onclose = () => URL.revokeObjectURL(url);
  dlg.innerHTML = `
  <div class="pad">
    <div class="row" style="align-items:center"><button class="icon-btn" id="dBack" aria-label="Indietro" style="flex:none">←</button><h2 style="flex:1">Controlla il documento</h2></div>
    <div class="preview">${d.mime.startsWith('image/') ? `<img src="${url}" alt="Anteprima del documento">` : '<div class="pdf" role="img" aria-label="Documento PDF">📄</div>'}</div>
    ${fresh ? '<p class="hint">Ho letto il documento. Controlla che titolo, categoria e scadenza siano giusti, poi salva.</p>' : ''}
    <label class="f">Titolo<input id="dTitle" value="${esc(d.title)}"></label>
    <div><b>Categoria</b><div class="chips" id="dCats" style="flex-wrap:wrap;margin-top:.4rem">${Object.entries(CATS).map(([k, c]) => `<button class="chip-btn" data-k="${k}" aria-pressed="${d.cat === k}">${c.icon} ${c.label}</button>`).join('')}</div></div>
    <div class="box">
      <b>Scadenza e promemoria</b>
      <div id="dDueInfo"></div>
      <label class="f">Data scadenza<input id="dDue" type="date" value="${d.due || ''}"></label>
      <label class="f">Tipo<input id="dLabel" value="${esc(d.dueLabel || 'Scadenza')}"></label>
      <div class="row"><button class="btn" id="dIcs">📅 Aggiungi al calendario</button></div>
      <p class="hint">Il calendario del telefono ti avviserà 7 giorni prima, il giorno prima e il giorno stesso, anche ad app chiusa.</p>
    </div>
    <label class="f">Nota (facoltativa)<textarea id="dNote" rows="2">${esc(d.note)}</textarea></label>
    <div class="row"><button class="btn" id="dOpen">↗ Apri</button><button class="btn" id="dShare">⤴ Condividi</button></div>
    <button class="btn fill big" id="dSave">💾 Salva</button>
    ${d.text ? `<details><summary>Testo letto dal documento</summary><pre>${esc(d.text)}</pre></details>` : ''}
    <button class="btn danger" id="dDel">🗑 Elimina documento</button>
  </div>`;
  const q = s => dlg.querySelector(s);
  const info = () => { q('#dDueInfo').innerHTML = draft.due ? dueChip(draft.due) : '<span class="hint">Nessuna scadenza trovata. Se il documento ne ha una, impostala tu.</span>'; };
  info();
  q('#dBack').onclick = () => dlg.close();
  q('#dCats').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; draft.cat = b.dataset.k; dlg.querySelectorAll('#dCats .chip-btn').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  q('#dDue').onchange = e => { draft.due = e.target.value || null; info(); };
  q('#dIcs').onclick = () => { draft.title = q('#dTitle').value; draft.dueLabel = q('#dLabel').value; if (!draft.due) return toast('Imposta prima una data di scadenza.'); downloadIcs([draft], `dodifile-${draft.id}.ics`); };
  q('#dOpen').onclick = () => window.open(url, '_blank');
  q('#dShare').onclick = async () => {
    const f = new File([d.blob], `${d.title.replace(/[^\w\- ]+/g, '').trim() || 'documento'}.${d.mime === 'application/pdf' ? 'pdf' : 'jpg'}`, { type: d.mime });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: d.title }); } catch { /* annullato */ } }
    else toast('La condivisione non è supportata da questo browser: usa «Apri».');
  };
  q('#dSave').onclick = async () => {
    draft.title = q('#dTitle').value.trim() || d.title;
    draft.note = q('#dNote').value;
    draft.dueLabel = draft.due ? (q('#dLabel').value.trim() || 'Scadenza') : null;
    draft.search = buildSearch(draft);
    await dbPut(draft); await reload(); dlg.close(); toast('Salvato ✓'); notifyDue();
  };
  q('#dDel').onclick = async () => { if (confirm('Eliminare il documento? Non si può annullare.')) { await dbDel(d.id); await reload(); dlg.close(); toast('Documento eliminato'); } };
  openDialog(dlg);
}

/* ---------- Calendario (.ics) e avvisi ---------- */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
function buildIcs(list) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DodiFile//IT', 'CALSCALE:GREGORIAN'];
  for (const d of list) {
    if (!d.due) continue;
    const end = parseIso(d.due); end.setDate(end.getDate() + 1);
    L.push('BEGIN:VEVENT', `UID:dodifile-${d.id}@dodifile`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${iso(end).replace(/-/g, '')}`,
      `SUMMARY:${icsEsc(`${d.dueLabel || 'Scadenza'}: ${d.title}`)}`);
    for (const t of ['-P6DT15H', '-PT15H', 'PT9H']) L.push('BEGIN:VALARM', `TRIGGER:${t}`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(d.title)}`, 'END:VALARM'); // 9:00: 7 gg prima, 1 gg prima, stesso giorno
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
function downloadIcs(list, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buildIcs(list)], { type: 'text/calendar' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function notifyDue() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration();
  for (const d of docs) {
    if (!d.due) continue;
    const dl = daysLeft(d.due); if (dl > 7) continue;
    const key = `n-${iso(new Date())}-${d.id}`;
    try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, '1'); } catch { /* ok */ }
    const title = `${d.dueLabel || 'Scadenza'}: ${dayText(dl).toLowerCase()}`, opt = { body: d.title, icon: 'icons/icon-192.png', tag: 'doc-' + d.id };
    if (reg) reg.showNotification(title, opt); else new Notification(title, opt);
  }
}

/* ---------- Impostazioni + DEV ---------- */
function openSettings(scrollToDev) {
  const dlg = $('#settings');
  const radio = (name, val, label, cur) => `<label class="opt"><input type="radio" name="${name}" value="${val}" ${String(cur) === String(val) ? 'checked' : ''}> ${label}</label>`;
  const notifState = 'Notification' in window ? Notification.permission : 'unsupported';
  dlg.innerHTML = `
  <div class="pad">
    <div class="row" style="align-items:center"><button class="icon-btn" id="sBack" aria-label="Indietro" style="flex:none">←</button><h2 style="flex:1">Impostazioni</h2></div>
    <section><h2>Dimensione del testo</h2>${radio('scale', 1, 'Normale', prefs.scale)}${radio('scale', 1.25, 'Grande', prefs.scale)}${radio('scale', 1.5, 'Molto grande', prefs.scale)}</section>
    <section><h2>Aspetto</h2>${radio('theme', 'auto', 'Come il telefono', prefs.theme)}${radio('theme', 'light', 'Chiaro', prefs.theme)}${radio('theme', 'dark', 'Scuro', prefs.theme)}</section>
    <section class="box"><h2>Promemoria</h2>
      <p class="hint">Per avvisi garantiti anche ad app chiusa usa «Aggiungi al calendario» in ogni documento, oppure esporta tutte le scadenze in un colpo solo.</p>
      <div class="row"><button class="btn" id="sIcs">📅 Esporta tutte le scadenze</button>
      <button class="btn" id="sNotif" ${notifState === 'unsupported' || notifState === 'granted' ? 'disabled' : ''}>${notifState === 'granted' ? '🔔 Avvisi all’apertura attivi' : '🔔 Attiva avvisi all’apertura'}</button></div>
    </section>
    <section class="box"><h2>🔒 I tuoi dati restano tuoi</h2><p class="hint">Documenti, testo letto e scadenze sono salvati solo su questo dispositivo (nel browser). Nessun account, nessun server.</p></section>
    <section class="dev" id="devCard">
      <div class="av" aria-hidden="true">AD</div>
      <div class="tag">DEV</div>
      <h3>${esc(DEV.name)}</h3>
      <div>Sviluppatore di DodiFile</div>
      <hr style="width:100%;border:0;border-top:1px solid currentColor;opacity:.25">
      <p>Grazie di cuore per aver scaricato DodiFile! Spero che ti aiuti a mettere ordine nelle tue carte e a non dimenticare più nessuna scadenza. Se ti piace, consiglialo a chi ami: più siamo, meno carta sul tavolo.</p>
      <a class="btn" href="${esc(DEV.github)}" target="_blank" rel="noopener">💻 Vedi il progetto su GitHub</a>
      <small>Versione 1.0.0 · Open source · 100% offline</small>
    </section>
  </div>`;
  const q = s => dlg.querySelector(s);
  q('#sBack').onclick = () => dlg.close();
  dlg.querySelectorAll('input[name=scale]').forEach(i => i.onchange = () => prefs.set('scale', i.value));
  dlg.querySelectorAll('input[name=theme]').forEach(i => i.onchange = () => prefs.set('theme', i.value));
  q('#sIcs').onclick = () => { const l = docs.filter(d => d.due); l.length ? downloadIcs(l, 'dodifile-scadenze.ics') : toast('Non ci sono ancora scadenze.'); };
  q('#sNotif').onclick = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Avvisi attivati' : 'Avvisi non attivati'); openSettings(false); notifyDue(); };
  openDialog(dlg);
  if (scrollToDev) requestAnimationFrame(() => q('#devCard').scrollIntoView({ behavior: 'smooth', block: 'end' }));
}

/* ---------- Avvio ---------- */
applyPrefs();
reload().then(notifyDue);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); notifyDue(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
