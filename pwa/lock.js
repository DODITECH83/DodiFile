'use strict';
/* DodiFile – blocco app: PIN (PBKDF2) + impronta/volto/blocco schermo (WebAuthn, solo sul dispositivo).
   Nota: è un blocco di accesso all'app. I dati restano nel browser del dispositivo, non sono cifrati. */

const ic = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } }, del: k => { try { localStorage.removeItem(k); } catch { /* */ } } };

/** Tastierino numerico riusabile (schermata di blocco e finestre PIN). */
function Keypad(root, { len, onDone, showBio, onBio }) {
  let val = '';
  root.innerHTML = `<div class="dots" role="img" aria-label="Inserisci il PIN">${'<i></i>'.repeat(len)}</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button type="button" data-k="${k}" aria-label="${k}">${k}</button>`).join('')}
    <button type="button" data-bio class="ghost" ${showBio ? '' : 'disabled'} aria-label="Sblocca con impronta">${showBio ? ic('fingerprint') : ''}</button>
    <button type="button" data-k="0" aria-label="0">0</button>
    <button type="button" data-del class="ghost" aria-label="Cancella">${ic('back')}</button></div>`;
  const dots = root.querySelectorAll('.dots i');
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
  const press = k => { if (val.length < len) { val += k; paint(); if (val.length === len) { const v = val; setTimeout(() => onDone(v), 120); } } };
  root.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k !== undefined) press(b.dataset.k);
    else if ('del' in b.dataset) { val = val.slice(0, -1); paint(); }
    else if ('bio' in b.dataset && showBio) onBio && onBio();
  };
  return {
    press, back() { val = val.slice(0, -1); paint(); },
    reset() { val = ''; paint(); },
    shake() { root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); }
  };
}

const Lock = {
  locked: false,
  skipUntil: 0,       // evita di bloccare mentre è aperta la fotocamera / il selettore file
  hiddenAt: 0,

  enabled() { return !!prefs.get('lockOn') && !!LS.get('dodifile.pin'); },
  pause(ms = 120000) { this.skipUntil = Date.now() + ms; },

  async hash(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 150000, hash: 'SHA-256' }, key, 256));
  },
  async setPin(pin) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    LS.set('dodifile.pin', JSON.stringify({ salt, hash: await this.hash(pin, salt), len: pin.length }));
    LS.del('dodifile.fails');
  },
  pinLen() { try { return JSON.parse(LS.get('dodifile.pin')).len || 4; } catch { return 4; } },
  /** Restituisce {ok} oppure {ok:false, wait:secondi}. Dopo 5 errori si attende, sempre di più. */
  async checkPin(pin) {
    const f = JSON.parse(LS.get('dodifile.fails') || '{"n":0,"until":0}');
    if (Date.now() < f.until) return { ok: false, wait: Math.ceil((f.until - Date.now()) / 1000) };
    const rec = JSON.parse(LS.get('dodifile.pin') || 'null');
    if (rec && (await this.hash(pin, rec.salt)) === rec.hash) { LS.del('dodifile.fails'); return { ok: true }; }
    f.n++; if (f.n >= 5) f.until = Date.now() + 30000 * 2 ** Math.min(f.n - 5, 4);
    LS.set('dodifile.fails', JSON.stringify(f));
    return { ok: false, wait: Math.max(0, Math.ceil((f.until - Date.now()) / 1000)) };
  },
  clear() { LS.del('dodifile.pin'); LS.del('dodifile.fails'); LS.del('dodifile.cred'); },

  /* ----- Impronta / volto / blocco schermo ----- */
  async bioAvailable() {
    try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
  },
  async registerBio() {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'DodiFile' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'dodifile', displayName: 'DodiFile' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000
    } });
    LS.set('dodifile.cred', b64(cred.rawId));
  },
  async verifyBio() {
    const id = LS.get('dodifile.cred'); if (!id) return false;
    try {
      await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
        userVerification: 'required', timeout: 60000
      } });
      return true;
    } catch { return false; }
  },
  hasBio() { return !!prefs.get('bioOn') && !!LS.get('dodifile.cred'); },

  /* ----- Schermata di blocco ----- */
  show(message) {
    this.locked = true;
    const el = document.getElementById('lock'); el.hidden = false;
    document.documentElement.classList.add('locked');
    const len = this.pinLen();
    const msg = el.querySelector('#lockMsg');
    msg.textContent = message || 'Inserisci il PIN per entrare';
    this.pad = Keypad(el.querySelector('#lockPad'), {
      len, showBio: this.hasBio(), onBio: () => this.tryBio(),
      onDone: async pin => {
        const r = await this.checkPin(pin);
        if (r.ok) return this.hide();
        this.pad.reset(); this.pad.shake();
        msg.textContent = r.wait ? `Troppi tentativi. Riprova tra ${r.wait} secondi.` : 'PIN errato, riprova.';
      }
    });
    if (this.hasBio()) setTimeout(() => this.tryBio(), 250);
  },
  async tryBio() { if (await this.verifyBio()) this.hide(); },
  hide() {
    this.locked = false;
    document.getElementById('lock').hidden = true;
    document.documentElement.classList.remove('locked');
  },
  /** Da chiamare quando l'app torna in primo piano. */
  onVisible() {
    if (!this.enabled() || this.locked || !this.hiddenAt) return;
    const away = (Date.now() - this.hiddenAt) / 1000;
    if (Date.now() < this.skipUntil) return;
    if (prefs.get('lockTimeout') === 0 || away >= prefs.get('lockTimeout')) this.show();
  },
  lockNow() { if (this.enabled()) this.show(); }
};

document.addEventListener('visibilitychange', () => { if (document.hidden) Lock.hiddenAt = Date.now(); else Lock.onVisible(); });
document.addEventListener('keydown', e => {
  if (!Lock.locked || !Lock.pad) return;
  if (/^\d$/.test(e.key)) Lock.pad.press(e.key); else if (e.key === 'Backspace') Lock.pad.back();
});
