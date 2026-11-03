'use strict';
/* DodiFile – logica pura (stessa dell'app Android): categorie, scadenze, ricerca. Nessuna dipendenza dal DOM. */

const CATS = {
  casa:   { label: 'Casa',   icon: '🏠', kw: ['bolletta','luce','energia','gas','acqua','condominio','affitto','locazione','caldaia','elettricita','fornitura','pod','pdr','canone','internet','fibra','telefono','utenza'] },
  auto:   { label: 'Auto',   icon: '🚗', kw: ['auto','targa','bollo','assicurazione','rca','revisione','tagliando','carburante','patente','veicolo','autoveicolo','pneumatici','officina','kasko'] },
  salute: { label: 'Salute', icon: '🩺', kw: ['visita','medico','ricetta','farmaco','referto','analisi','ospedale','asl','clinica','terapia','prescrizione','tessera sanitaria','dentista','paziente','diagnosi'] },
  tasse:  { label: 'Tasse',  icon: '🏛️', kw: ['tasse','imposta','irpef','imu','tari','isee','f24','agenzia delle entrate','730','dichiarazione','tributi','fisco','certificazione unica','contributi','inps'] },
  spese:  { label: 'Spese',  icon: '🧾', kw: ['scontrino','ricevuta','fattura','garanzia','acquisto','totale','iva','pagamento','carta di credito','importo','negozio','ordine'] },
  lavoro: { label: 'Lavoro', icon: '💼', kw: ['busta paga','contratto di lavoro','stipendio','cedolino','assunzione','tfr','curriculum','azienda','dipendente'] },
  altro:  { label: 'Altro',  icon: '📁', kw: [] }
};

const MONTHS = { gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6, luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12 };

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLeft = (isoDate, today = startOfToday()) => Math.round((parseIso(isoDate) - today) / 864e5);

function classify(text) {
  const t = norm(text);
  let best = 'altro', bestScore = 0;
  for (const [key, c] of Object.entries(CATS)) {
    const score = c.kw.filter(k => t.includes(k)).length;
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

function toDate(y, mo, d) {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}

function findDates(t) {
  const out = [];
  let m;
  const num = /(?<!\d)(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/g;
  while ((m = num.exec(t))) { const d = toDate(+m[3], +m[2], +m[1]); if (d) out.push({ index: m.index, date: d }); }
  const txt = new RegExp(`(?<!\\d)(\\d{1,2}) (${Object.keys(MONTHS).join('|')}) (\\d{4})`, 'g');
  while ((m = txt.exec(t))) { const d = toDate(+m[3], MONTHS[m[2]], +m[1]); if (d) out.push({ index: m.index, date: d }); }
  return out;
}

const CONTEXTS = [
  [/scadenz|scade|scadra/g, 'Scadenza'],
  [/entro il|entro e non oltre|pagare entro|pagabile entro|pagamento entro/g, 'Pagamento entro'],
  [/valid[oa] fino|valido al|fino al/g, 'Valido fino al'],
  [/garanzia/g, 'Fine garanzia']
];

function addMonths(d, n) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), dim));
}

/** Restituisce {date:'YYYY-MM-DD', label} oppure null. Non inventa scadenze. */
function extractDue(raw, today = startOfToday()) {
  const t = norm(raw);
  const dates = findDates(t);
  const tagged = [];
  for (const f of dates) {
    const win = t.slice(Math.max(0, f.index - 50), f.index);
    let best = null;
    for (const [re, label] of CONTEXTS) {
      let last = -1, m; re.lastIndex = 0;
      while ((m = re.exec(win))) last = m.index + m[0].length;
      if (last >= 0 && (!best || last > best.pos)) best = { pos: last, label };
    }
    if (best) tagged.push({ date: f.date, label: best.label });
  }
  const upcoming = tagged.filter(x => x.date >= today).sort((a, b) => a.date - b.date)[0];
  const chosen = upcoming || tagged.sort((a, b) => b.date - a.date)[0];
  if (chosen) return { date: iso(chosen.date), label: chosen.label };

  const w = /garanzia[^0-9]{0,25}(\d{1,2}) (mesi|mese|anni|anno)/.exec(t);
  if (w) {
    const n = +w[1] * (w[2].startsWith('ann') ? 12 : 1);
    const limit = new Date(today.getTime() + 864e5);
    const purchase = dates.map(x => x.date).filter(d => d <= limit).sort((a, b) => a - b)[0];
    if (purchase) return { date: iso(addMonths(purchase, n)), label: 'Fine garanzia' };
  }
  return null;
}

function analyze(text, today = startOfToday()) {
  const title = (text || '').split('\n').map(l => l.trim())
    .find(l => l.length >= 4 && l.length <= 60 && /\p{L}{4,}/u.test(l))
    || `Documento del ${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  return { title, cat: classify(text), due: extractDue(text, today) };
}

/* ---------- Ricerca semantica semplificata ---------- */
const GROUPS = [
  ['caldaia','gas','riscaldamento','termosifone','boiler','metano','manutenzione'],
  ['lavatrice','lavastoviglie','frigorifero','forno','asciugatrice','elettrodomestico','garanzia'],
  ['luce','energia','elettricita','kwh','enel','bolletta'],
  ['acqua','idrico','idrica','bolletta'],
  ['auto','macchina','bollo','assicurazione','rca','revisione','tagliando','targa','patente'],
  ['medico','visita','ricetta','farmaco','analisi','referto','ospedale','salute','asl'],
  ['tasse','imu','tari','irpef','isee','fisco','f24','730'],
  ['affitto','locazione','contratto','condominio','casa'],
  ['scontrino','spesa','ricevuta','fattura','pagamento']
];

function expand(tok) {
  const s = new Set();
  for (const g of GROUPS) if (g.some(w => w === tok || (tok.length >= 3 && w.startsWith(tok)))) g.forEach(w => s.add(w));
  s.delete(tok);
  return [...s];
}

function withinOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; }
    else {
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function scoreDoc(doc, tokens) {
  const title = norm(doc.title), hay = doc.search;
  let words = null, total = 0;
  for (const tok of tokens) {
    let s = 0;
    if (title.includes(tok)) s += 4;
    if (hay.includes(tok)) s += 2;
    else if (tok.length >= 5) {
      words = words || new Set(hay.split(/[^a-z0-9]+/));
      for (const w of words) if (withinOne(w, tok)) { s += 1; break; }
    }
    for (const e of expand(tok)) if (hay.includes(e)) s += 1;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

function rank(docs, query) {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (!tokens.length) return docs;
  return docs.map(d => [d, scoreDoc(d, tokens)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}

function dayText(dl) {
  if (dl === -1) return 'Scaduto ieri';
  if (dl < 0) return `Scaduto da ${-dl} giorni`;
  if (dl === 0) return 'Scade oggi';
  if (dl === 1) return 'Scade domani';
  return `Scade tra ${dl} giorni`;
}
const urgency = dl => dl == null ? 'none' : dl < 0 ? 'over' : dl <= 7 ? 'soon' : 'later';

if (typeof module !== 'undefined') module.exports = { CATS, norm, iso, parseIso, daysLeft, classify, extractDue, analyze, rank, withinOne, dayText, urgency };
