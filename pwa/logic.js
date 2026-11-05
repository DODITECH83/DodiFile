'use strict';
/* DodiFile – logica pura (stessa dell'app Android): categorie, scadenze, importi, ricerca. Nessuna dipendenza dal DOM. */

const CATS = {
  casa:   { label: 'Casa',   icon: 'home',      color: '#3B82F6', kw: ['bolletta','luce','energia','gas','acqua','condominio','affitto','locazione','caldaia','elettricita','fornitura','pod','pdr','canone','internet','fibra','telefono','utenza'] },
  auto:   { label: 'Auto',   icon: 'car',       color: '#F59E0B', kw: ['auto','targa','bollo','assicurazione','rca','revisione','tagliando','carburante','patente','veicolo','autoveicolo','pneumatici','officina','kasko'] },
  salute: { label: 'Salute', icon: 'heart',     color: '#EF4444', kw: ['visita','medico','ricetta','farmaco','referto','analisi','ospedale','asl','clinica','terapia','prescrizione','tessera sanitaria','dentista','paziente','diagnosi'] },
  tasse:  { label: 'Tasse',  icon: 'landmark',  color: '#8B5CF6', kw: ['tasse','imposta','irpef','imu','tari','isee','f24','agenzia delle entrate','730','dichiarazione','tributi','fisco','certificazione unica','contributi','inps'] },
  spese:  { label: 'Spese',  icon: 'receipt',   color: '#10B981', kw: ['scontrino','ricevuta','fattura','garanzia','acquisto','totale','iva','pagamento','carta di credito','importo','negozio','ordine'] },
  lavoro: { label: 'Lavoro', icon: 'briefcase', color: '#0EA5E9', kw: ['busta paga','contratto di lavoro','stipendio','cedolino','assunzione','tfr','curriculum','azienda','dipendente'] },
  altro:  { label: 'Altro',  icon: 'folder',    color: '#64748B', kw: [] }
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

/** Data del documento: la prima data del testo che non sia nel futuro (es. data dello scontrino). */
function extractDocDate(raw, today = startOfToday()) {
  const limit = new Date(today.getTime() + 864e5);
  const d = findDates(norm(raw)).sort((a, b) => a.index - b.index).map(x => x.date).find(x => x <= limit);
  return d ? iso(d) : null;
}

/** Importo in euro ("totale 82,40", "da pagare € 1.234,56"). Restituisce un numero o null. */
function extractAmount(raw) {
  const t = norm(raw);
  const re = /(?:totale(?: complessivo| da pagare| importo)?|importo(?: dovuto| totale)?|da pagare|netto a pagare|saldo)\D{0,25}?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?!\d|[.\/]\d)/;
  const m = re.exec(t);
  return m ? parseAmount(m[1]) : null;
}
function parseAmount(s) {
  s = String(s ?? '').replace(/[€\s]/g, '');
  if (!s) return null;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/* ---------- Titoli intelligenti: "Bolletta luce · Enel · nov 2026" ---------- */
const ISSUERS = [['enel energia','Enel Energia'],['enel','Enel'],['eni plenitude','Eni Plenitude'],['plenitude','Plenitude'],['eni','Eni'],['a2a','A2A'],['edison','Edison'],['iren','Iren'],['hera','Hera'],['acea','Acea'],['sorgenia','Sorgenia'],['e.on','E.ON'],['illumia','Illumia'],['tim','TIM'],['vodafone','Vodafone'],['windtre','WindTre'],['wind tre','WindTre'],['iliad','Iliad'],['fastweb','Fastweb'],['poste italiane','Poste Italiane'],['unicredit','UniCredit'],['intesa sanpaolo','Intesa Sanpaolo'],['esselunga','Esselunga'],['coop','Coop'],['conad','Conad'],['carrefour','Carrefour'],['lidl','Lidl'],['eurospin','Eurospin'],['ikea','IKEA'],['mediaworld','MediaWorld'],['unieuro','Unieuro'],['amazon','Amazon'],['leroy merlin','Leroy Merlin'],['decathlon','Decathlon'],['generali','Generali'],['unipolsai','UnipolSai'],['unipol','UnipolSai'],['allianz','Allianz'],['axa','AXA'],['reale mutua','Reale Mutua'],['agenzia delle entrate','Agenzia delle Entrate'],['inps','INPS'],['farmacia','Farmacia'],['trenitalia','Trenitalia'],['italo','Italo'],['telepass','Telepass'],['netflix','Netflix'],['spotify','Spotify'],['sky','Sky'],['dazn','DAZN']]
  .map(([k, name]) => ({ name, len: k.length, re: new RegExp('(?<![a-z0-9])' + k.replace(/\./g, '\\.') + '(?![a-z0-9])') }));

const TYPES_A = [
  [/bollo auto|tassa automobilistica|tassa di proprieta (del )?(veicol|auto)/, 'Bollo auto'],
  [/revisione (veicol|auto)|revisione periodica/, 'Revisione auto'],
  [/polizza|certificato di assicurazione|assicurazione (auto|rca|casa|vita)|\brca\b/, 'Assicurazione'],
  [/modello f24|\bf24\b/, 'F24'], [/\bimu\b/, 'IMU'], [/\btari\b|tassa rifiuti/, 'TARI'], [/\bisee\b/, 'ISEE'],
  [/modello 730|dichiarazione dei redditi/, 'Modello 730'], [/certificazione unica/, 'Certificazione Unica'],
  [/contratto di (locazione|affitto)|canone di locazione/, 'Contratto d’affitto'],
  [/busta paga|cedolino|prospetto paga/, 'Busta paga'],
  [/ricetta (medica|dematerializzata)/, 'Ricetta medica'], [/referto/, 'Referto'],
  [/visita (medica|specialistica)/, 'Visita medica'], [/analisi del sangue|esami del sangue/, 'Analisi mediche']
];
const TYPES_B = [
  [/scontrino|documento commerciale/, 'Scontrino'],
  [/certificato di garanzia|garanzia (legale|convenzionale)|garanzia \d+ (mesi|anni)/, 'Garanzia'],
  [/spese condominiali|condominio/, 'Spese condominiali'],
  [/bollettino/, 'Bollettino'], [/fattura/, 'Fattura'], [/ricevuta/, 'Ricevuta'], [/contratto/, 'Contratto']
];
const UTILITIES = [
  ['Bolletta luce', /energia elettrica|\bkwh\b|\bpod\b|\bluce\b|potenza impegnata/g],
  ['Bolletta gas', /metano|\bsmc\b|\bpdr\b|gas naturale|\bgas\b/g],
  ['Bolletta acqua', /servizio idrico|idric[oa]|\bacqua\b|\bmc\b/g],
  ['Bolletta internet', /fibra|\badsl\b|internet|linea fissa|linea telefonica/g]
];
function docType(t) {
  for (const [re, name] of TYPES_A) if (re.test(t)) return name;
  const bill = /bolletta|fornitura|utenza|fattura/.test(t), strong = /bolletta/.test(t);
  if (bill) {
    const scores = UTILITIES.map(([name, re]) => [name, (t.match(re) || []).length]).sort((a, b) => b[1] - a[1]);
    if (scores[0][1] >= 2 || (strong && scores[0][1] >= 1)) return scores[0][0];
    if (strong) return 'Bolletta';
  }
  for (const [re, name] of TYPES_B) if (re.test(t)) return name;
  return null;
}
const titleCase = s => s.split(' ').filter(Boolean).map(w => w.length > 3 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w).join(' ');
function findIssuer(t, raw) {
  let best = null;
  for (const i of ISSUERS) { const m = i.re.exec(t); if (m && (!best || m.index < best.index || (m.index === best.index && i.len > best.len))) best = { name: i.name, index: m.index, len: i.len }; }
  if (best) return best.name;
  for (const line of (raw || '').split('\n').slice(0, 12)) { // "Rossi Mario S.r.l." → "Rossi Mario"
    const m = /^\W*([A-Za-zÀ-ÿ&' ]{3,40}?)\s+(?:s\.?\s?p\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?)(?:\W|$)/i.exec(line.trim());
    if (m && m[1].trim().split(' ').length <= 4) return titleCase(m[1].trim());
  }
  return null;
}
const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
function smartTitle(raw, ctx = {}) {
  const t = norm(raw), type = docType(t), issuer = findIssuer(t, raw);
  if (!type && !issuer) return null;
  if (!type) return `Documento ${issuer}`;
  const parts = [type];
  if (issuer && !norm(type).includes(norm(issuer))) parts.push(issuer);
  const d = ctx.docDate || ctx.due;
  if (d && /^(Bolletta|Fattura)/.test(type)) { const [y, m] = d.split('-').map(Number); parts.push(`${MON[m - 1]} ${y}`); }
  else if (type === 'Scontrino' && ctx.docDate) { const [, m, dd] = ctx.docDate.split('-').map(Number); parts.push(`${dd} ${MON[m - 1]}`); }
  return parts.join(' · ');
}
/** Righe del testo che potrebbero essere un buon titolo (pulite, non troppo corte/lunghe, non numeriche). */
function titleCandidates(raw, max = 3) {
  const out = [];
  for (let l of (raw || '').split('\n')) {
    l = l.replace(/[^\p{L}\p{N} .,&'’\-]/gu, ' ').replace(/\s+/g, ' ').trim();
    const letters = (l.match(/\p{L}/gu) || []).length;
    if (l.length < 5 || l.length > 42 || letters / l.length < 0.7 || !/\p{L}{4,}/u.test(l)) continue;
    const c = titleCase(l); if (!out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

function analyze(text, today = startOfToday()) {
  const due = extractDue(text, today), docDate = extractDocDate(text, today);
  const alts = titleCandidates(text);
  const title = smartTitle(text, { docDate, due: due?.date }) || alts[0]
    || `Documento del ${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  return { title, alts: alts.filter(a => a !== title), cat: classify(text), due, amount: extractAmount(text), docDate };
}

/** Prossima scadenza di un documento ricorrente (sempre nel futuro). */
function nextDue(isoDate, repeat, today = startOfToday()) {
  const step = { monthly: 1, quarterly: 3, yearly: 12 }[repeat];
  if (!step) return isoDate;
  let d = parseIso(isoDate), i = 0;
  do { i++; d = addMonths(parseIso(isoDate), step * i); } while (d < today && i < 600);
  return iso(d);
}

/** Durata ICS "prima dell'inizio" per un promemoria di N giorni prima alle ore H (evento all-day = ore 00:00). */
function icsTrigger(daysBefore, hour) {
  const off = daysBefore * 1440 - hour * 60; // minuti prima della mezzanotte del giorno di scadenza
  if (off === 0) return 'PT0S';
  const abs = Math.abs(off), d = Math.floor(abs / 1440), h = Math.floor((abs % 1440) / 60), m = abs % 60;
  const time = (h ? h + 'H' : '') + (m ? m + 'M' : '');
  return (off > 0 ? '-' : '') + 'P' + (d ? d + 'D' : '') + (time ? 'T' + time : '');
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
  const title = norm(doc.title), hay = doc.search || '';
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

/* ---------- Testi e formati ---------- */
function dayText(dl) {
  if (dl === -1) return 'Scaduto ieri';
  if (dl < 0) return `Scaduto da ${-dl} giorni`;
  if (dl === 0) return 'Scade oggi';
  if (dl === 1) return 'Scade domani';
  return `Scade tra ${dl} giorni`;
}
const urgency = dl => dl == null ? 'none' : dl < 0 ? 'over' : dl <= 7 ? 'soon' : 'later';
const bucket = dl => dl < 0 ? 'over' : dl <= 7 ? 'week' : dl <= 31 ? 'month' : 'later';
const greeting = (h = new Date().getHours()) => h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
const fmtEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = s => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseIso(s));
const fmtBytes = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

if (typeof module !== 'undefined') module.exports = { smartTitle, titleCandidates, docType, CATS, norm, iso, parseIso, daysLeft, classify, extractDue, extractDocDate, extractAmount, parseAmount, analyze, nextDue, icsTrigger, rank, withinOne, dayText, urgency, bucket, greeting, fmtEuro, fmtBytes };
