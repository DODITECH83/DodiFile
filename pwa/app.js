'use strict';
/* DodiFile PWA v2 – interfaccia. Archivio locale, OCR locale (Tesseract.js), PDF (pdf.js). Nessun server. */

const DEV = { name: 'Adry Doditech', github: 'https://github.com/DODITECH83/DodiFile' };
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const VERSION = '2.0.0';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let docs = [];
const ui = { tab: 'home', query: '', cat: null, showDone: false, month: iso(new Date()).slice(0, 7), recent: [] };
try { ui.recent = JSON.parse(localStorage.getItem('dodifile.recent') || '[]'); } catch { /* */ }

/* =====================  Utilità interfaccia  ===================== */
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button id="toastAct">${esc(action.label)}</button>` : ''}`;
  if (action) $('#toastAct').onclick = () => { t.classList.remove('show'); action.fn(); };
  t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), action ? 7000 : 4000);
}

/* Le finestre si chiudono anche col tasto "indietro" del telefono */
const dlgStack = []; let popping = false, ignorePop = 0;
function openDlg(d) { if (d.open) return; d.showModal(); dlgStack.push(d); history.pushState({ dlg: d.id }, ''); }
function closeDlg(d) { if (d.open) d.close(); }
document.addEventListener('close', e => {
  const i = dlgStack.indexOf(e.target); if (i < 0) return;
  dlgStack.splice(i, 1);
  if (popping) { popping = false; return; }
  ignorePop++; history.back();
}, true);
window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = dlgStack[dlgStack.length - 1]; if (top) { popping = true; top.close(); }
});
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d && !['busy', 'onboard', 'pin'].includes(d.id)) closeDlg(d); }));
$('#busy').addEventListener('cancel', e => e.preventDefault());

/** Finestra di conferma, restituisce true/false */
function ask(title, text, okLabel = 'OK', danger = false, noLabel = 'Annulla') {
  return new Promise(res => {
    const d = $('#ask');
    d.innerHTML = `<div class="pad"><h2>${esc(title)}</h2><p class="hint" style="font-size:1rem">${esc(text)}</p>
      <div class="row"><button class="btn" id="aNo">${esc(noLabel)}</button><button class="btn fill ${danger ? 'danger' : ''}" id="aYes" ${danger ? 'style="background:var(--over);border-color:var(--over);color:#fff"' : ''}>${esc(okLabel)}</button></div></div>`;
    let ans = false;
    d.onclose = () => res(ans);
    $('#aNo').onclick = () => closeDlg(d);
    $('#aYes').onclick = () => { ans = true; closeDlg(d); };
    openDlg(d);
  });
}

/** Finestra con tastierino PIN. validate(pin) → true oppure testo d'errore. Restituisce il PIN o null. */
function askPin({ title, sub, len, validate }) {
  return new Promise(res => {
    const d = $('#pin');
    d.innerHTML = `<div class="pad"><h2>${esc(title)}</h2><p class="hint" id="pinSub">${esc(sub || '')}</p><div id="pinPad" style="width:100%"></div><button class="linkbtn" id="pinCancel">Annulla</button></div>`;
    let result = null;
    const pad = Keypad($('#pinPad'), { len, showBio: false, onDone: async pin => {
      const v = validate ? await validate(pin) : true;
      if (v === true) { result = pin; closeDlg(d); } else { pad.reset(); pad.shake(); $('#pinSub').textContent = v; }
    } });
    d.onclose = () => res(result);
    $('#pinCancel').onclick = () => closeDlg(d);
    openDlg(d);
  });
}

const urgChip = (dl, done) => {
  if (done) return `<span class="due ok">${ic('checkc')} Completato</span>`;
  if (dl == null) return '';
  const u = urgency(dl);
  return `<span class="due ${u}">${ic(u === 'over' ? 'alert' : u === 'soon' ? 'clock' : 'checkc')} ${dayText(dl)}</span>`;
};

/* =====================  Dati  ===================== */
async function reload() {
  docs = [];
  for (const r of await dbAll()) {
    const d = { ...normDoc(r), ...r, done: !!r.done };
    if (!r.uid) await dbPut(d); // documenti della versione 1: assegno un identificativo stabile
    docs.push(d);
  }
  renderAll();
}
const byDue = (a, b) => a.due.localeCompare(b.due);
const activeDue = () => docs.filter(d => d.due && !d.done);

function renderAll() {
  const n = activeDue().filter(d => daysLeft(d.due) <= 7).length;
  const badge = $('#dueBadge'); badge.hidden = !n; badge.textContent = n;
  $('#btnLockNow').hidden = !Lock.enabled();
  ({ home: renderHome, due: renderDue, stats: renderStats, settings: renderSettings })[ui.tab]();
}

function goTab(tab) {
  ui.tab = tab;
  $$('.view').forEach(v => v.hidden = v.dataset.view !== tab);
  $$('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  renderAll(); window.scrollTo({ top: 0 });
}
$$('.tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));

/* =====================  Cassetto (home)  ===================== */
function cardHtml(d) {
  const c = CATS[d.cat] || CATS.altro, dl = d.due && !d.done ? daysLeft(d.due) : null;
  const meta = [c.label, d.docDate ? fmtDate(d.docDate) : null, d.amount != null ? fmtEuro(d.amount) : null].filter(Boolean).join(' · ');
  return `<li><button class="card" data-open="${d.id}">
    <span class="cat" style="--c:${c.color}">${d.thumb ? `<img class="blur" src="${d.thumb}" alt="">` : ic(c.icon)}</span>
    <span class="txt"><b class="blur">${esc(d.title)}</b><small class="blur">${esc(meta)}</small>${urgChip(dl, d.done && d.due)}</span>
    ${d.fav ? ic('star', 'fav') : ''}</button></li>`;
}

function renderHome() {
  const el = $('#view-home'), today = startOfToday(), name = prefs.get('name').trim();
  const act = activeDue().sort(byDue);
  const over = act.filter(d => daysLeft(d.due, today) < 0).length, soon = act.filter(d => { const x = daysLeft(d.due, today); return x >= 0 && x <= 7; }).length;
  const next = act[0];
  const headline = !docs.length ? 'Metti ordine alle tue carte' : over ? `${over} ${over === 1 ? 'scadenza è scaduta' : 'scadenze sono scadute'}` : soon ? `${soon} ${soon === 1 ? 'scadenza' : 'scadenze'} nei prossimi 7 giorni` : 'Tutto in ordine, niente di urgente';
  const nag = prefs.get('backupNag') && docs.length >= 3 && Date.now() - prefs.get('lastBackup') > 30 * 864e5;

  el.innerHTML = `
  <div class="hero ${over ? 'warn' : ''}">
    <div class="hello">${greeting()}${name ? ', ' + esc(name) : ''}</div>
    <h2>${headline}</h2>
    ${next ? `<button class="next" data-open="${next.id}">${ic(daysLeft(next.due) < 0 ? 'alert' : 'clock')}<span class="t"><b>${esc(next.title)}</b><small>${esc(next.dueLabel || 'Scadenza')} · ${dayText(daysLeft(next.due, today)).toLowerCase()}</small></span>${ic('chev')}</button>` : ''}
    <div class="hero-stats"><div><b>${docs.length}</b>documenti</div><div><b>${act.length}</b>scadenze attive</div><div><b>${docs.filter(d => d.fav).length}</b>preferiti</div></div>
  </div>
  ${nag ? `<div class="banner">${ic('db')}<span class="t">Sono passati più di 30 giorni dall'ultimo backup. Salva una copia dei tuoi documenti.</span><button class="btn" data-act="backup">Salva</button></div>` : ''}
  <div class="search">
    <span class="lead">${ic('search')}</span>
    <label class="sr" for="q" style="position:absolute;left:-9999px">Cerca nei documenti</label>
    <input id="q" type="search" placeholder="Cerca: caldaia, bollo…" autocomplete="off" enterkeyhint="search" value="${esc(ui.query)}">
    <button class="clr ghost round" id="btnClear" aria-label="Cancella ricerca" ${ui.query ? '' : 'hidden'}>${ic('x')}</button>
  </div>
  <div id="recent"></div>
  <div class="chips" id="chips" role="group" aria-label="Filtra per categoria"></div>
  <div id="listwrap"></div>
  <button class="devlink" data-act="goDev">${ic('code')} DEV · Info sviluppatore</button>`;
  renderList();
}

function renderList() {
  const total = docs.length; if (ui.tab !== 'home') return;
  $('#btnClear').hidden = !ui.query;
  $('#recent').innerHTML = !ui.query && ui.recent.length && total ? `<div class="recent">Recenti: ${ui.recent.map(r => `<button class="chip" data-recent="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : '';
  const count = k => docs.filter(d => d.cat === k).length;
  $('#chips').innerHTML = total ? `<button class="chip" data-cat="" aria-pressed="${ui.cat === null}">Tutti</button>
    <button class="chip" data-cat="__fav" aria-pressed="${ui.cat === '__fav'}">${ic('star')} Preferiti</button>
    ${Object.entries(CATS).filter(([k]) => count(k)).map(([k, c]) => `<button class="chip" data-cat="${k}" aria-pressed="${ui.cat === k}">${ic(c.icon)} ${c.label} · ${count(k)}</button>`).join('')}` : '';

  let shown = ui.cat === '__fav' ? docs.filter(d => d.fav) : ui.cat ? docs.filter(d => d.cat === ui.cat) : docs;
  const sort = prefs.get('sort');
  if (ui.query.trim()) shown = rank(shown, ui.query);
  else shown = [...shown].sort({
    recent: (a, b) => b.created - a.created,
    due: (a, b) => (a.due && !a.done ? a.due : '9999').localeCompare(b.due && !b.done ? b.due : '9999'),
    name: (a, b) => a.title.localeCompare(b.title, 'it'),
    cat: (a, b) => a.cat.localeCompare(b.cat) || b.created - a.created
  }[sort] || ((a, b) => b.created - a.created));

  const filtering = ui.query.trim() || ui.cat;
  $('#listwrap').innerHTML = !shown.length ? `<div class="empty"><div class="art">${ic(filtering ? 'search' : 'archive')}</div>
      <h2>${filtering ? 'Nessun documento trovato' : 'Il tuo cassetto è vuoto'}</h2>
      <p>${filtering ? 'Prova con un’altra parola o togli il filtro.' : 'Fotografa una bolletta, uno scontrino o una garanzia: leggo io date e importi e ti avviso prima della scadenza.'}</p>
      ${filtering ? '' : `<button class="btn fill" data-act="add">${ic('plus')} Aggiungi il primo documento</button>`}</div>`
    : `<div class="listhead"><h3>${ui.query ? 'Risultati' : 'I tuoi documenti'} <span class="hint">(${shown.length})</span></h3>
        ${ui.query ? '' : `<label class="sortsel">${ic('sort')}<select id="sortSel" aria-label="Ordina per">${[['recent', 'Più recenti'], ['due', 'Scadenza'], ['name', 'Nome A–Z'], ['cat', 'Categoria']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}</div>
      <ul class="list" style="margin-top:.6rem">${shown.map(cardHtml).join('')}</ul>`;
}

function rememberSearch() {
  const q = ui.query.trim(); if (q.length < 3 || !rank(docs, q).length) return;
  ui.recent = [q, ...ui.recent.filter(x => x !== q)].slice(0, 4);
  try { localStorage.setItem('dodifile.recent', JSON.stringify(ui.recent)); } catch { /* */ }
}

/* =====================  Scadenze  ===================== */
function renderDue() {
  const el = $('#view-due'), today = startOfToday();
  const items = docs.filter(d => d.due && (ui.showDone || !d.done)).sort(byDue);
  const groups = [['over', 'Scadute'], ['week', 'Nei prossimi 7 giorni'], ['month', 'Entro un mese'], ['later', 'Più avanti']];
  const row = d => {
    const c = CATS[d.cat], dl = daysLeft(d.due, today);
    return `<div class="dueitem ${d.done ? 'isdone' : ''}">
      <button class="check" data-done="${d.id}" aria-label="${d.done ? 'Segna come da fare' : 'Segna come fatto'}">${ic(d.done ? 'checkc' : 'circle')}</button>
      <button class="open" data-open="${d.id}"><span class="t"><b>${esc(d.title)}</b>${urgChip(dl, d.done)}<small class="hint">${esc(d.dueLabel || 'Scadenza')} · ${fmtDate(d.due)}${d.repeat !== 'none' ? ' · ripetuta' : ''}</small></span>
      ${d.amount != null ? `<span class="amt">${fmtEuro(d.amount)}</span>` : ''}</button></div>`;
  };
  let html = '';
  for (const [k, label] of groups) {
    const g = items.filter(d => !d.done && bucket(daysLeft(d.due, today)) === k);
    if (g.length) html += `<div class="sectitle ${k === 'over' ? 'over' : k === 'week' ? 'soon' : ''}">${label} · ${g.length}</div>${g.map(row).join('')}`;
  }
  const done = items.filter(d => d.done);
  if (done.length) html += `<div class="sectitle">Completate · ${done.length}</div>${done.map(row).join('')}`;
  el.innerHTML = `<div class="pagehead"><h1>Scadenze</h1>
      <button class="btn" data-act="icsAll" ${activeDue().length ? '' : 'disabled'}>${ic('calendar')} Calendario</button></div>
    <label class="toggle-inline"><span class="sw"><input type="checkbox" id="showDone" ${ui.showDone ? 'checked' : ''}><span></span></span> Mostra anche le completate</label>
    ${html || `<div class="empty"><div class="art">${ic('calendar')}</div><h2>Nessuna scadenza</h2><p>Quando scansioni una bolletta o una garanzia, la data compare qui e ti avviso in tempo. Puoi anche creare un promemoria a mano col pulsante +.</p></div>`}`;
}

async function toggleDone(id) {
  const d = docs.find(x => x.id === id); if (!d) return;
  const prev = structuredClone({ ...d, blob: undefined }); prev.blob = d.blob;
  if (d.done) { d.done = false; await dbPut(d); await reload(); return; }
  if (d.repeat !== 'none' && d.due) {
    d.history = [...(d.history || []), { paid: iso(new Date()), due: d.due, amount: d.amount }];
    d.due = nextDue(d.due, d.repeat);
    toast(`Fatto! Prossima scadenza: ${fmtDate(d.due)}`, { label: 'Annulla', fn: async () => { await dbPut(prev); await reload(); } });
  } else {
    d.done = true; toast('Segnato come fatto', { label: 'Annulla', fn: async () => { await dbPut(prev); await reload(); } });
  }
  await dbPut(d); await reload();
}

/* =====================  Riepilogo  ===================== */
function renderStats() {
  const el = $('#view-stats');
  const dateOf = d => d.docDate || iso(new Date(d.created));
  const withAmt = docs.filter(d => d.amount != null);
  const monthSum = m => withAmt.filter(d => dateOf(d).startsWith(m)).reduce((s, d) => s + d.amount, 0);
  const [y, mo] = ui.month.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1));
  const inMonth = withAmt.filter(d => dateOf(d).startsWith(ui.month));
  const total = inMonth.reduce((s, d) => s + d.amount, 0);
  const perCat = Object.keys(CATS).map(k => [k, inMonth.filter(d => d.cat === k).reduce((s, d) => s + d.amount, 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const months6 = [...Array(6)].map((_, i) => { const dt = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1); return { key: iso(dt).slice(0, 7), label: new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(dt) }; });
  const sums = months6.map(m => monthSum(m.key)), max = Math.max(...sums, 1);
  const toPay = activeDue().filter(d => d.amount != null && daysLeft(d.due) <= 30);
  const toPaySum = toPay.reduce((s, d) => s + d.amount, 0);
  const bytes = docs.reduce((s, d) => s + (d.blob?.size || 0), 0);

  el.innerHTML = `<div class="pagehead"><h1>Riepilogo</h1></div>
    <div class="kpis"><div class="kpi"><b>${docs.length}</b><span>Documenti</span></div><div class="kpi"><b>${activeDue().length}</b><span>Scadenze attive</span></div><div class="kpi"><b>${fmtBytes(bytes)}</b><span>Spazio usato</span></div></div>
    <div class="panel"><h2>Da pagare nei prossimi 30 giorni</h2>
      <div class="big">${fmtEuro(toPaySum)}</div>
      <p class="hint">${toPay.length ? `${toPay.length} ${toPay.length === 1 ? 'documento' : 'documenti'} con importo e scadenza.` : 'Nessun importo in scadenza. Gli importi vengono letti da "Totale" o "Importo" nei documenti.'}</p></div>
    <div class="panel"><div class="month-nav"><button class="ghost round" data-month="-1" aria-label="Mese precedente">${ic('chevl')}</button><b>${monthLabel}</b><button class="ghost round" data-month="1" aria-label="Mese successivo">${ic('chev')}</button></div>
      <div class="big">${fmtEuro(total)}</div><p class="hint" style="margin-top:-.4rem">Spesa del mese in ${inMonth.length} ${inMonth.length === 1 ? 'documento' : 'documenti'}</p>
      ${perCat.map(([k, v]) => `<div class="bar-row" style="--c:${CATS[k].color}"><span class="lab">${ic(CATS[k].icon)}${CATS[k].label}</span><span class="track"><span class="fill" style="display:block;width:${Math.round(v / total * 100)}%"></span></span><b>${fmtEuro(v)}</b></div>`).join('') || '<p class="hint">Nessuna spesa registrata in questo mese.</p>'}</div>
    <div class="panel"><h2>Ultimi 6 mesi</h2><div class="vchart" role="img" aria-label="Spese degli ultimi sei mesi">
      ${months6.map((m, i) => `<div class="col ${m.key === ui.month ? 'cur' : ''}" title="${fmtEuro(sums[i])}"><span class="vb" style="height:${Math.max(4, Math.round(sums[i] / max * 100))}%"></span><span>${m.label}</span></div>`).join('')}</div></div>
    <p class="hint" style="text-align:center">Importi e date sono letti dai documenti: puoi correggerli aprendo il documento.</p>`;
}

/* =====================  Aggiunta documenti  ===================== */
function openSheet() {
  const s = $('#sheet');
  s.innerHTML = `<div class="pad"><h2 style="font-size:1.4rem">Aggiungi</h2>
    <button class="action" id="optCam"><span class="sico">${ic('camera')}</span><span><b>Scatta una foto</b><span class="d">Bolletta, scontrino, garanzia…</span></span></button>
    <button class="action" id="optFile"><span class="sico">${ic('upload')}</span><span><b>Carica PDF o foto</b><span class="d">Scegli un file dal telefono</span></span></button>
    <button class="action" id="optNote"><span class="sico">${ic('bell')}</span><span><b>Solo un promemoria</b><span class="d">Una scadenza senza documento</span></span></button>
    <button class="btn" id="sheetClose">Annulla</button></div>`;
  $('#sheetClose').onclick = () => closeDlg(s);
  $('#optCam').onclick = () => { Lock.pause(); closeDlg(s); $('#fileCam').click(); };
  $('#optFile').onclick = () => { Lock.pause(); closeDlg(s); $('#fileAny').click(); };
  $('#optNote').onclick = async () => {
    closeDlg(s);
    const rec = normDoc({ title: 'Nuovo promemoria', cat: 'altro', due: null, dueLabel: null, text: '', note: '', created: Date.now(), mime: null, blob: null, thumb: null });
    rec.search = buildSearch(rec); const id = await dbPut(rec); await reload(); openDetail(id, true);
  };
  openDlg(s);
}
$('#btnScan').onclick = openSheet;
for (const id of ['#fileCam', '#fileAny']) $(id).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; Lock.pause(30000); if (f) importFile(f); });

const loaded = {};
const loadScript = url => loaded[url] || (loaded[url] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = url; s.onload = res;
  s.onerror = () => { delete loaded[url]; rej(new Error('Impossibile caricare ' + url)); };
  document.head.appendChild(s);
}));

async function shrink(blob, max = 1800, enhance = false) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d'); if (enhance) ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.05)';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  } catch { return blob; }
}
const setBusy = (msg, pct) => { $('#busyMsg').textContent = msg; $('#busyHint').innerHTML = pct != null ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''; };

async function ocrBlob(blob) {
  await loadScript(TESS);
  const w = await Tesseract.createWorker(prefs.get('ocrLang'), 1, { logger: m => { if (m.status === 'recognizing text') setBusy('Leggo il testo…', Math.round(m.progress * 100)); else if (m.status?.includes('loading')) setBusy('Preparo il motore di lettura…', null); } });
  try { return (await w.recognize(blob)).data.text || ''; } finally { await w.terminate(); }
}
async function pdfText(file) {
  await loadScript(PDFJS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    setBusy(`Leggo la pagina ${i} di ${Math.min(pdf.numPages, 5)}…`, null);
    const page = await pdf.getPage(i);
    let t = (await page.getTextContent()).items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('');
    if (t.replace(/\s/g, '').length < 30) {
      const vp = page.getViewport({ scale: 2 }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      t = await ocrBlob(await new Promise(r => c.toBlob(r, 'image/png')));
    }
    out += t + '\n';
  }
  return out;
}

async function importFile(file) {
  setBusy('Sto leggendo il documento…', null); $('#busy').showModal();
  requestPersist();
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const blob = isPdf ? file : await shrink(file);
    let text = '';
    try {
      text = isPdf ? await pdfText(file) : await ocrBlob(prefs.get('ocrEnhance') ? await shrink(file, 2000, true) : blob);
    } catch (err) { console.warn(err); toast('Lettura automatica non disponibile (serve internet la prima volta). Salvato: controlla tu i dati.'); }
    const a = analyze(text);
    const rec = normDoc({
      title: a.title, cat: a.cat, due: prefs.get('autoDue') ? a.due?.date || null : null, dueLabel: prefs.get('autoDue') ? a.due?.label || null : null,
      amount: a.amount, docDate: a.docDate, text, note: '', created: Date.now(), mime: isPdf ? 'application/pdf' : (blob.type || 'image/jpeg'), blob, thumb: null
    });
    rec.search = buildSearch(rec);
    if (!isPdf) rec.thumb = await blobToDataURL(await shrink(blob, 160));
    const id = await dbPut(rec);
    await reload(); $('#busy').close(); openDetail(id, true);
  } catch (err) { console.error(err); $('#busy').close(); toast('Non sono riuscito a salvare il documento. Riprova.'); }
}

/* =====================  Dettaglio documento  ===================== */
async function openDetail(id, fresh = false) {
  const d = docs.find(x => x.id === id); if (!d) return;
  const draft = { ...d }, dlg = $('#detail');
  const url = d.blob ? URL.createObjectURL(d.blob) : null;
  dlg.onclose = () => { if (url) URL.revokeObjectURL(url); window.speechSynthesis?.cancel?.(); };
  const canSpeak = 'speechSynthesis' in window && d.text;
  dlg.innerHTML = `
  <div class="dhead"><button class="ghost round" id="dBack" aria-label="Indietro">${ic('back')}</button><h2>${fresh ? 'Controlla i dati' : 'Documento'}</h2>
    <button class="ghost round" id="dFav" aria-label="Preferito" aria-pressed="${!!draft.fav}">${ic('star', draft.fav ? 'fav' : '')}</button></div>
  <div class="pad">
    ${url || fresh ? `<div class="preview">${url && d.mime?.startsWith('image/') ? `<img src="${url}" alt="Anteprima del documento">` : `<div class="noimg">${ic(url ? 'file' : 'bell')}</div>`}</div>` : ''}
    ${fresh && d.blob ? '<p class="hint">Ho letto il documento. Controlla che titolo, categoria, scadenza e importo siano giusti, poi salva.</p>' : ''}
    <label class="f">Titolo<input id="dTitle" value="${esc(d.title)}"></label>
    <div><b style="font-size:.95rem">Categoria</b><div class="chips" id="dCats" style="flex-wrap:wrap;margin-top:.45rem">${Object.entries(CATS).map(([k, c]) => `<button class="chip" data-k="${k}" aria-pressed="${d.cat === k}">${ic(c.icon)} ${c.label}</button>`).join('')}</div></div>
    <div class="box"><h3>Scadenza e promemoria</h3><div id="dInfo"></div>
      <div class="cols2"><label class="f">Data<input id="dDue" type="date" value="${d.due || ''}"></label><label class="f">Tipo<input id="dLabel" value="${esc(d.dueLabel || 'Scadenza')}"></label></div>
      <label class="f">Si ripete<select id="dRepeat">${[['none', 'Mai'], ['monthly', 'Ogni mese'], ['quarterly', 'Ogni 3 mesi'], ['yearly', 'Ogni anno']].map(([v, l]) => `<option value="${v}" ${d.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="row"><button class="btn" id="dIcs">${ic('calendar')} Aggiungi al calendario</button><button class="btn ${d.done ? '' : 'fill'}" id="dDone">${ic('checkc')} ${d.done ? 'Riapri' : 'Segna come fatto'}</button></div>
      <p class="hint">Gli avvisi arrivano ${prefs.get('remDays').slice().sort((a, b) => b - a).map(x => x === 0 ? 'il giorno stesso' : x + (x === 1 ? ' giorno prima' : ' giorni prima')).join(', ')}, alle ${String(prefs.get('remHour')).padStart(2, '0')}:00.</p></div>
    <div class="cols2"><label class="f">Importo (€)<input id="dAmount" inputmode="decimal" placeholder="0,00" value="${d.amount != null ? String(d.amount).replace('.', ',') : ''}"></label>
      <label class="f">Data documento<input id="dDocDate" type="date" value="${d.docDate || ''}"></label></div>
    <label class="f">Nota (facoltativa)<textarea id="dNote" rows="2">${esc(d.note)}</textarea></label>
    ${d.history?.length ? `<details><summary>Storico (${d.history.length})</summary><pre>${d.history.map(h => `Pagato il ${fmtDate(h.paid)} (scadenza ${fmtDate(h.due)})${h.amount != null ? ' · ' + fmtEuro(h.amount) : ''}`).join('\n')}</pre></details>` : ''}
    <div class="row">${url ? `<button class="btn" id="dOpen">${ic('ext')} Apri</button><button class="btn" id="dShare">${ic('share')} Condividi</button>` : ''}${canSpeak ? `<button class="btn" id="dSpeak">${ic('speaker')} Leggi</button>` : ''}</div>
    <button class="btn fill big" id="dSave">${ic('check')} Salva</button>
    ${d.text ? `<details><summary>Testo letto dal documento</summary><pre>${esc(d.text)}</pre></details>` : ''}
    <button class="btn danger" id="dDel">${ic('trash')} Elimina</button>
  </div>`;
  const q = s => dlg.querySelector(s);
  const info = () => { q('#dInfo').innerHTML = draft.due ? urgChip(daysLeft(draft.due), draft.done) : '<span class="hint">Nessuna scadenza. Se il documento ne ha una, impostala qui sotto.</span>'; };
  info();
  q('#dBack').onclick = () => closeDlg(dlg);
  q('#dFav').onclick = e => { draft.fav = !draft.fav; e.currentTarget.innerHTML = ic('star', draft.fav ? 'fav' : ''); e.currentTarget.setAttribute('aria-pressed', draft.fav); };
  q('#dCats').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; draft.cat = b.dataset.k; dlg.querySelectorAll('#dCats .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  q('#dDue').onchange = e => { draft.due = e.target.value || null; info(); };
  const collect = () => {
    draft.title = q('#dTitle').value.trim() || d.title; draft.note = q('#dNote').value;
    draft.dueLabel = draft.due ? (q('#dLabel').value.trim() || 'Scadenza') : null; draft.repeat = q('#dRepeat').value;
    draft.amount = parseAmount(q('#dAmount').value); draft.docDate = q('#dDocDate').value || null; draft.search = buildSearch(draft);
  };
  q('#dIcs').onclick = () => { collect(); if (!draft.due) return toast('Imposta prima una data di scadenza.'); downloadIcs([draft], `dodifile-${draft.id}.ics`); };
  q('#dDone').onclick = async () => { collect(); await dbPut({ ...draft, done: d.done }); await reload(); closeDlg(dlg); await toggleDone(d.id); };
  if (url) {
    q('#dOpen').onclick = () => { Lock.pause(); window.open(url, '_blank'); };
    q('#dShare').onclick = async () => {
      const f = new File([d.blob], `${d.title.replace(/[^\w\- ]+/g, '').trim() || 'documento'}.${d.mime === 'application/pdf' ? 'pdf' : 'jpg'}`, { type: d.mime });
      if (navigator.canShare?.({ files: [f] })) { Lock.pause(); try { await navigator.share({ files: [f], title: d.title }); } catch { /* annullato */ } } else toast('La condivisione non è supportata da questo browser: usa «Apri».');
    };
  }
  if (canSpeak) q('#dSpeak').onclick = () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(d.text.replace(/\s+/g, ' ').slice(0, 3000)); u.lang = 'it-IT'; speechSynthesis.speak(u);
  };
  q('#dSave').onclick = async () => { collect(); draft.done = d.done; await dbPut(draft); await reload(); closeDlg(dlg); toast('Salvato'); notifyDue(); };
  q('#dDel').onclick = async () => { if (await ask('Eliminare il documento?', 'Verrà cancellato dal telefono. Non si può annullare.', 'Elimina', true)) { await dbDel(d.id); await reload(); closeDlg(dlg); toast('Documento eliminato'); } };
  openDlg(dlg);
}

/* =====================  Calendario (.ics) e avvisi  ===================== */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
function buildIcs(list) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z', hour = prefs.get('remHour'), days = prefs.get('remDays');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DodiFile//IT', 'CALSCALE:GREGORIAN'];
  for (const d of list) {
    if (!d.due) continue;
    const end = parseIso(d.due); end.setDate(end.getDate() + 1);
    L.push('BEGIN:VEVENT', `UID:dodifile-${d.uid || d.id}@dodifile`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${iso(end).replace(/-/g, '')}`,
      `SUMMARY:${icsEsc(`${d.dueLabel || 'Scadenza'}: ${d.title}`)}`);
    if (d.amount != null) L.push(`DESCRIPTION:${icsEsc('Importo: ' + fmtEuro(d.amount))}`);
    for (const n of days) L.push('BEGIN:VALARM', `TRIGGER:${icsTrigger(n, hour)}`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(d.title)}`, 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
function downloadBlob(blob, name) {
  Lock.pause(30000);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
const downloadIcs = (list, name) => downloadBlob(new Blob([buildIcs(list)], { type: 'text/calendar' }), name);

async function notifyDue() {
  if (!prefs.get('notifyOpen') || !('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration(), horizon = Math.max(...prefs.get('remDays'), 0);
  for (const d of activeDue()) {
    const dl = daysLeft(d.due); if (dl > horizon) continue;
    const key = `n-${iso(new Date())}-${d.id}`;
    try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, '1'); } catch { /* */ }
    const title = `${d.dueLabel || 'Scadenza'}: ${dayText(dl).toLowerCase()}`, opt = { body: d.title, icon: 'icons/icon-192.png', tag: 'doc-' + d.id };
    if (reg) reg.showNotification(title, opt); else new Notification(title, opt);
  }
}

/* =====================  Impostazioni  ===================== */
const sw = (key, on) => `<label class="sw"><input type="checkbox" data-pref="${key}" ${on ? 'checked' : ''}><span></span></label>`;
const srow = (icon, title, sub, ctrl = '', danger = false) => `<div class="srow"><span class="sico ${danger ? 'danger' : ''}">${ic(icon)}</span><div class="rt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctrl}</div>`;
const brow = (icon, title, sub, act, danger = false) => `<button class="srow" data-act="${act}"><span class="sico ${danger ? 'danger' : ''}">${ic(icon)}</span><div class="rt"><b ${danger ? 'style="color:var(--over)"' : ''}>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ic('chev', 'chev')}</button>`;
const seg = (key, opts, cur) => `<div class="seg" data-seg="${key}" role="group">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
let deferredInstall = null, storageCache = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (ui.tab === 'settings') renderSettings(); });

async function renderSettings() {
  const el = $('#view-settings'), p = prefs.data, bio = await Lock.bioAvailable();
  storageCache = storageCache || await storageInfo();
  const si = storageCache, bytes = docs.reduce((s, d) => s + (d.blob?.size || 0), 0);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  el.innerHTML = `<div class="pagehead"><h1>Impostazioni</h1></div>

  <div class="ghead">Profilo</div>
  <div class="group"><div class="srow">${`<span class="sico">${ic('user')}</span>`}<div class="rt"><b>Il tuo nome</b><small>Per salutarti nella home</small></div><input class="field-inline" data-text="name" value="${esc(p.name)}" placeholder="Es. Maria" maxlength="20" style="width:8rem" aria-label="Il tuo nome"></div></div>

  <div class="ghead">Aspetto</div>
  <div class="group">
    <div class="srow-col">${srow('sun', 'Tema', 'Chiaro, scuro o come il telefono').replace('</div></div>', '</div></div>')}${seg('theme', [['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']], p.theme)}</div>
    <div class="srow-col">${srow('palette', 'Colore dell’app', 'Scegli quello che preferisci')}<div class="swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button class="swatch" style="--c:${a.c}" data-swatch="${k}" aria-pressed="${p.accent === k}" aria-label="${a.label}">${p.accent === k ? ic('check') : ''}</button>`).join('')}</div></div>
    <div class="srow-col">${srow('type', 'Dimensione del testo', 'Più grande = più facile da leggere')}${seg('scale', [[1, 'Normale'], [1.15, 'Grande'], [1.3, 'Molto'], [1.5, 'Enorme']], p.scale)}<div class="preview-text">Ecco come si legge il testo: <b>Bolletta del gas</b>, scade tra 5 giorni.</div></div>
    ${srow('contrast', 'Contrasto alto', 'Bordi e testi più marcati', sw('contrast', p.contrast))}
    ${srow('list', 'Elenco compatto', 'Mostra più documenti nello schermo', sw('density', p.density === 'compact'))}
    ${srow('wind', 'Riduci le animazioni', 'Movimenti più calmi', sw('calm', p.calm))}
  </div>

  <div class="ghead">Sicurezza e privacy</div>
  <div class="group">
    ${srow('lock', 'Blocco con PIN', 'Chiede il PIN quando apri l’app', sw('lock', Lock.enabled()))}
    ${Lock.enabled() ? `
      ${bio ? srow('fingerprint', 'Impronta, volto o blocco schermo', Lock.hasBio() ? 'Attivo: sblocchi con un tocco' : 'Sblocca senza digitare il PIN', sw('bio', Lock.hasBio())) : srow('fingerprint', 'Impronta o volto', 'Non disponibile su questo dispositivo/browser')}
      ${brow('pin', 'Cambia PIN', '', 'changePin')}
      <div class="srow-col">${srow('timer', 'Blocca dopo', 'Da quando esci dall’app')}${seg('lockTimeout', [[0, 'Subito'], [30, '30 sec'], [60, '1 min'], [300, '5 min']], p.lockTimeout)}</div>` : ''}
    ${srow('eyeoff', 'Modalità privacy', 'Sfoca titoli e anteprime nell’elenco (tieni premuto per vedere)', sw('privacy', p.privacy))}
  </div>

  <div class="ghead">Promemoria</div>
  <div class="group">
    <div class="srow-col">${srow('bell', 'Avvisami', 'Quanti giorni prima della scadenza')}<div class="multi">${[[30, '30 giorni'], [14, '14 giorni'], [7, '7 giorni'], [3, '3 giorni'], [1, '1 giorno'], [0, 'Il giorno stesso']].map(([v, l]) => `<button class="chip" data-multi="${v}" aria-pressed="${p.remDays.includes(v)}">${l}</button>`).join('')}</div></div>
    ${srow('clock', 'Ora dell’avviso', 'Vale per il calendario', `<input type="time" class="field-inline" data-time="remHour" value="${String(p.remHour).padStart(2, '0')}:00" aria-label="Ora dell’avviso">`)}
    ${srow('sparkles', 'Avvisi all’apertura', 'Una notifica per le scadenze vicine quando apri l’app', sw('notifyOpen', p.notifyOpen))}
    ${brow('calendar', 'Esporta nel calendario', 'Avvisi garantiti anche ad app chiusa', 'icsAll')}
  </div>

  <div class="ghead">Lettura dei documenti</div>
  <div class="group">
    <div class="srow-col">${srow('globe', 'Lingua dei documenti', 'Per leggere meglio il testo')}${seg('ocrLang', [['ita', 'Italiano'], ['eng', 'English'], ['ita+eng', 'Entrambe']], p.ocrLang)}</div>
    ${srow('sparkles', 'Migliora le foto prima della lettura', 'Più contrasto: legge meglio le foto scure', sw('ocrEnhance', p.ocrEnhance))}
    ${srow('calendar', 'Trova le scadenze da solo', 'Imposta la data se la riconosce nel testo', sw('autoDue', p.autoDue))}
  </div>

  <div class="ghead">I tuoi dati</div>
  <div class="group">
    ${srow('db', 'Spazio usato', `${docs.length} documenti · ${fmtBytes(bytes)}${si.quota ? ' su ' + fmtBytes(si.quota) + ' disponibili' : ''}`)}
    ${srow('shield', 'Archivio protetto', si.persisted ? 'Il browser non cancellerà i tuoi dati da solo' : 'Non ancora garantito: scansiona un documento o installa l’app per proteggerlo')}
    ${brow('download', 'Salva un backup', 'Un file con tutti i documenti, da conservare', 'backup')}
    ${brow('upload', 'Ripristina da backup', 'Unisce i documenti del file a quelli presenti', 'restore')}
    ${srow('bell', 'Ricordami il backup', 'Dopo 30 giorni senza copie', sw('backupNag', p.backupNag))}
    ${brow('trash', 'Elimina tutti i dati', 'Cancella documenti e impostazioni da questo telefono', 'wipe', true)}
  </div>

  <div class="ghead">App</div>
  <div class="group">
    ${!standalone && deferredInstall ? brow('install', 'Installa DodiFile', 'Aggiungila alla schermata Home', 'install') : ''}
    ${brow('sparkles', 'Come si usa', 'Rivedi la presentazione', 'tour')}
    ${srow('info', 'Versione', `DodiFile ${VERSION} · ${standalone ? 'installata' : 'nel browser'}`)}
  </div>

  <div class="ghead" id="devAnchor">DEV</div>
  <div class="dev" id="devCard">
    <div class="av" aria-hidden="true">AD</div><div class="tag">DEV</div><h3>${esc(DEV.name)}</h3><div>Sviluppatore di DodiFile</div><hr>
    <p>Grazie di cuore per aver scaricato DodiFile! Spero che ti aiuti a mettere ordine nelle tue carte e a non dimenticare più nessuna scadenza. Se ti piace, consiglialo a chi ami: più siamo, meno carta sul tavolo.</p>
    <a class="btn" href="${esc(DEV.github)}" target="_blank" rel="noopener">${ic('code')} Vedi il progetto su GitHub</a>
    <small>Versione ${VERSION} · Open source · 100% offline</small>
  </div>`;
  if (renderSettings.scrollDev) { renderSettings.scrollDev = false; $('#devAnchor').scrollIntoView({ behavior: 'smooth' }); }
}

async function setLock(on) {
  if (on) {
    const len = (await ask('Lunghezza del PIN', 'Un PIN di 4 cifre è più veloce, uno di 6 è più sicuro. Quale preferisci?', '6 cifre', false, '4 cifre')) ? 6 : 4;
    const pin1 = await askPin({ title: 'Scegli il PIN', sub: `Inserisci ${len} cifre`, len }); if (!pin1) return;
    const pin2 = await askPin({ title: 'Ripeti il PIN', sub: 'Per conferma', len, validate: p => p === pin1 || 'Non coincide, riprova' }); if (!pin2) return;
    await Lock.setPin(pin1); prefs.set('lockOn', true);
    toast('Blocco attivato. Non dimenticare il PIN!');
    if (await Lock.bioAvailable() && await ask('Usare impronta o volto?', 'Potrai sbloccare con un tocco, senza digitare il PIN.', 'Attiva')) await setBio(true);
  } else {
    const ok = await askPin({ title: 'Conferma il PIN', sub: 'Per disattivare il blocco', len: Lock.pinLen(), validate: async p => (await Lock.checkPin(p)).ok || 'PIN errato' });
    if (ok) { Lock.clear(); prefs.set('lockOn', false); prefs.set('bioOn', false); toast('Blocco disattivato'); }
  }
  renderAll();
}
async function setBio(on) {
  if (on) {
    try { await Lock.registerBio(); prefs.set('bioOn', true); toast('Impronta/volto attivati'); }
    catch (e) { console.warn(e); prefs.set('bioOn', false); toast('Non sono riuscito ad attivarla. Controlla che il telefono abbia un’impronta registrata.'); }
  } else { prefs.set('bioOn', false); LS.del('dodifile.cred'); toast('Sblocco biometrico disattivato'); }
  renderAll();
}
async function changePin() {
  const len = Lock.pinLen();
  const old = await askPin({ title: 'PIN attuale', len, validate: async p => (await Lock.checkPin(p)).ok || 'PIN errato' }); if (!old) return;
  const n1 = await askPin({ title: 'Nuovo PIN', sub: `Inserisci ${len} cifre`, len }); if (!n1) return;
  const n2 = await askPin({ title: 'Ripeti il nuovo PIN', len, validate: p => p === n1 || 'Non coincide, riprova' }); if (!n2) return;
  await Lock.setPin(n1); toast('PIN cambiato');
}

async function doBackup() {
  if (!docs.length) return toast('Non ci sono ancora documenti da salvare.');
  setBusy('Preparo il backup…', null); $('#busy').showModal();
  try { downloadBlob(await makeBackup(docs), `dodifile-backup-${iso(new Date())}.json`); prefs.set('lastBackup', Date.now()); toast('Backup salvato nei Download'); }
  finally { $('#busy').close(); } renderAll();
}
$('#fileRestore').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; Lock.pause(30000); if (!f) return;
  setBusy('Ripristino i documenti…', null); $('#busy').showModal();
  try { const n = await restoreBackup(f, docs); await reload(); toast(n ? `Ripristinati ${n} documenti` : 'Nessun documento nuovo da aggiungere'); }
  catch (err) { console.warn(err); toast('Il file non è un backup valido di DodiFile.'); }
  finally { $('#busy').close(); }
});
async function wipeAll() {
  if (!await ask('Eliminare tutto?', 'Verranno cancellati tutti i documenti e le impostazioni da questo telefono. Non si può annullare.', 'Elimina tutto', true)) return;
  if (!await ask('Sei proprio sicuro?', 'Se non hai fatto un backup, i documenti andranno persi per sempre.', 'Sì, elimina', true)) return;
  await dbClear(); Lock.clear(); try { localStorage.clear(); } catch { /* */ }
  prefs.data = { ...DEFAULTS }; applyPrefs(); ui.recent = []; await reload(); toast('Tutto eliminato');
}

/* Eventi delle impostazioni (delegati) */
const NUM = new Set(['scale', 'lockTimeout']);
$('#view-settings').addEventListener('click', async e => {
  const t = e.target;
  const sg = t.closest('[data-seg] button');
  if (sg) { const k = sg.parentElement.dataset.seg; prefs.set(k, NUM.has(k) ? parseFloat(sg.dataset.v) : sg.dataset.v); return renderSettings(); }
  const sx = t.closest('[data-swatch]'); if (sx) { prefs.set('accent', sx.dataset.swatch); return renderSettings(); }
  const mu = t.closest('[data-multi]');
  if (mu) { const v = +mu.dataset.multi, cur = prefs.get('remDays'); const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; if (!next.length) return toast('Tieni almeno un avviso attivo.'); prefs.set('remDays', next); return renderSettings(); }
  const a = t.closest('[data-act]'); if (!a) return;
  ({ changePin, backup: doBackup, wipe: wipeAll, icsAll: () => icsAll(), restore: () => { Lock.pause(); $('#fileRestore').click(); }, tour: () => openOnboarding(true),
     install: async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderSettings(); } })[a.dataset.act]?.();
});
$('#view-settings').addEventListener('change', async e => {
  const t = e.target, k = t.dataset.pref;
  if (k === 'lock') return setLock(t.checked);
  if (k === 'bio') return setBio(t.checked);
  if (k === 'density') return prefs.set('density', t.checked ? 'compact' : 'comfy');
  if (k === 'notifyOpen' && t.checked && 'Notification' in window && Notification.permission !== 'granted') {
    const r = await Notification.requestPermission(); if (r !== 'granted') { t.checked = false; toast('Per attivarli, consenti le notifiche nelle impostazioni del browser.'); return prefs.set('notifyOpen', false); }
    prefs.set('notifyOpen', true); notifyDue(); return;
  }
  if (k) prefs.set(k, t.checked);
  if (t.dataset.time) prefs.set('remHour', parseInt(t.value) || 9);
});
$('#view-settings').addEventListener('input', e => { if (e.target.dataset.text) prefs.set(e.target.dataset.text, e.target.value); });

function icsAll() { const l = docs.filter(d => d.due && !d.done); l.length ? downloadIcs(l, 'dodifile-scadenze.ics') : toast('Non ci sono scadenze attive.'); }

/* =====================  Eventi della home e delle scadenze  ===================== */
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) return openDetail(+o.dataset.open);
  const dn = e.target.closest('[data-done]'); if (dn) return toggleDone(+dn.dataset.done);
  const m = e.target.closest('[data-month]'); if (m) { const [y, mo] = ui.month.split('-').map(Number); ui.month = iso(new Date(y, mo - 1 + +m.dataset.month, 1)).slice(0, 7); return renderStats(); }
  const c = e.target.closest('#chips [data-cat]'); if (c) { ui.cat = c.dataset.cat || null; return renderList(); }
  const r = e.target.closest('[data-recent]'); if (r) { ui.query = r.dataset.recent; $('#q').value = ui.query; return renderList(); }
  if (e.target.closest('#btnClear')) { ui.query = ''; $('#q').value = ''; renderList(); return $('#q').focus(); }
  const a = e.target.closest('#view-home [data-act], #view-due [data-act], .banner [data-act]');
  if (a) ({ add: openSheet, goDev: () => { renderSettings.scrollDev = true; goTab('settings'); }, backup: doBackup, icsAll })[a.dataset.act]?.();
});
document.addEventListener('input', e => { if (e.target.id === 'q') { ui.query = e.target.value; renderList(); } });
document.addEventListener('keydown', e => { if (e.target.id === 'q' && e.key === 'Enter') { rememberSearch(); e.target.blur(); } });
document.addEventListener('focusout', e => { if (e.target.id === 'q') rememberSearch(); });
document.addEventListener('change', e => {
  if (e.target.id === 'sortSel') { prefs.set('sort', e.target.value); renderList(); }
  if (e.target.id === 'showDone') { ui.showDone = e.target.checked; renderDue(); }
});
$('#btnLockNow').onclick = () => Lock.lockNow();
$('#lockForgot').onclick = async () => {
  if (await ask('PIN dimenticato?', 'Per sicurezza non esiste un recupero: l’unico modo è cancellare tutti i dati dell’app. Se hai un backup potrai ripristinarlo.', 'Cancella e sblocca', true)) {
    await dbClear(); Lock.clear(); try { localStorage.clear(); } catch { /* */ } prefs.data = { ...DEFAULTS }; applyPrefs(); Lock.hide(); await reload();
  }
};

/* =====================  Benvenuto  ===================== */
function openOnboarding(again = false) {
  const slides = [
    { i: 'scan', t: 'Fotografa e hai finito', p: 'Scatta una foto a bollette, scontrini, garanzie o contratti. Ci penso io a leggerli.' },
    { i: 'calendar', t: 'Mai più scadenze dimenticate', p: 'Trovo le date da solo e ti avviso in tempo. Segni “fatto” e, se si ripete, preparo la prossima.' },
    { i: 'shield', t: 'Tutto resta tuo', p: 'Nessun account e nessun server: i documenti restano su questo telefono, anche con blocco a PIN e impronta.' },
    { i: 'sliders', t: 'Rendila tua', p: '' }
  ];
  let n = 0; const d = $('#onboard');
  const draw = () => {
    const s = slides[n], last = n === slides.length - 1;
    d.innerHTML = `<div class="pad" style="min-height:100%;align-content:space-between"><div style="display:flex;justify-content:flex-end"><button class="linkbtn" id="obSkip">${last ? '' : 'Salta'}</button></div>
      <div class="slide"><div class="art">${ic(s.i)}</div><h2>${s.t}</h2>${last ? `<label class="f" style="width:100%;max-width:20rem;text-align:left">Come ti chiami? (facoltativo)<input id="obName" value="${esc(prefs.get('name'))}" maxlength="20" placeholder="Es. Maria"></label>
        <div style="width:100%;max-width:20rem;text-align:left"><b style="font-size:.95rem">Dimensione del testo</b>${seg('obScale', [[1, 'Normale'], [1.15, 'Grande'], [1.3, 'Molto'], [1.5, 'Enorme']], prefs.get('scale'))}</div>` : `<p>${s.p}</p>`}</div>
      <div style="display:grid;gap:1rem"><div class="dotsnav">${slides.map((_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div><button class="btn fill big" id="obNext">${last ? 'Inizia' : 'Avanti'}</button></div></div>`;
    $('#obNext').onclick = () => { if (last) { prefs.set('name', $('#obName').value.trim()); prefs.set('onboarded', true); closeDlg(d); renderAll(); } else { n++; draw(); } };
    $('#obSkip').onclick = () => { prefs.set('onboarded', true); closeDlg(d); };
    d.querySelectorAll('[data-seg=obScale] button').forEach(b => b.onclick = () => { prefs.set('scale', parseFloat(b.dataset.v)); draw(); });
  };
  draw(); d.oncancel = e => e.preventDefault(); if (!d.open) { d.showModal(); }
  d.onclose = () => { prefs.set('onboarded', true); };
}

/* =====================  Avvio  ===================== */
(async function init() {
  applyPrefs();
  if (!prefs.get('lastBackup')) prefs.set('lastBackup', Date.now()); // il promemoria backup parte da oggi
  if (Lock.enabled()) Lock.show(); else document.documentElement.classList.remove('locked');
  await reload();
  notifyDue();
  if (!prefs.get('onboarded') && !Lock.locked) openOnboarding();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderAll(); notifyDue(); } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
