'use strict';
/* DodiFile – editor "Ruota e ritaglia" per le foto dei documenti (tutto sul dispositivo). */

/** Cerca il foglio chiaro sullo sfondo e restituisce un riquadro normalizzato {x,y,w,h}, oppure null se non è sicuro. */
function autoCropBox(bmp) {
  const k = 220 / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { g[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0; hist[g[i]]++; }
  // soglia di Otsu
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0); let on = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x] > thr) { rows[y]++; cols[x]++; on++; }
  const frac = on / (w * h); if (frac < 0.2 || frac > 0.96) return null;
  const first = (arr, n) => arr.findIndex(v => v > n * 0.12), last = (arr, n) => arr.length - 1 - [...arr].reverse().findIndex(v => v > n * 0.12);
  const x0 = first(cols, h), x1 = last(cols, h), y0 = first(rows, w), y1 = last(rows, w);
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return null;
  const m = 0.015, box = { x: Math.max(0, x0 / w - m), y: Math.max(0, y0 / h - m) };
  box.w = Math.min(1 - box.x, (x1 + 1) / w - box.x + m); box.h = Math.min(1 - box.y, (y1 + 1) / h - box.y + m);
  const area = box.w * box.h; return area > 0.3 && area < 0.96 ? box : null;
}

/** Apre l'editor. Restituisce il Blob ritagliato, il file originale se l'utente sceglie "Usa così", oppure null se annulla. */
function cropEditor(file) {
  return new Promise(async res => {
    const dlg = document.getElementById('crop');
    let bmp; try { bmp = await createImageBitmap(file); } catch { return res(file); }
    let rot = 0, box = autoCropBox(bmp) || { x: 0, y: 0, w: 1, h: 1 }, auto = !!autoCropBox(bmp), result = null, drag = null;
    dlg.innerHTML = `
      <div class="dhead"><button class="ghost round" id="cCancel" aria-label="Annulla">${ic('x')}</button><h2>Ritaglia il documento</h2></div>
      <div class="pad" style="padding-top:.4rem">
        <p class="hint" id="cHint">Trascina i bordi per inquadrare solo il foglio: la lettura sarà più precisa.</p>
        <div class="cropwrap" id="cWrap"><canvas id="cCanvas" aria-label="Foto da ritagliare"></canvas></div>
        <div class="row"><button class="btn" id="cLeft">${ic('rotl')} Ruota</button><button class="btn" id="cRight">${ic('rotr')} Ruota</button><button class="btn" id="cAuto">${ic('sparkles')} Automatico</button><button class="btn" id="cReset">Tutta la foto</button></div>
        <button class="btn fill big" id="cOk">${ic('check')} Conferma</button>
        <button class="linkbtn" id="cSkip">Usa la foto così com’è</button>
      </div>`;
    const wrap = dlg.querySelector('#cWrap'), cvs = dlg.querySelector('#cCanvas'), ctx = cvs.getContext('2d');
    const dims = () => rot % 2 ? [bmp.height, bmp.width] : [bmp.width, bmp.height];
    const drawRot = (c2, w, h) => { c2.save(); c2.translate(w / 2, h / 2); c2.rotate(rot * Math.PI / 2); const iw = rot % 2 ? h : w, ih = rot % 2 ? w : h; c2.drawImage(bmp, -iw / 2, -ih / 2, iw, ih); c2.restore(); };
    let cw = 0, ch = 0;
    function layout() {
      const [rw, rh] = dims(), maxW = Math.min(wrap.clientWidth || 340, 640), maxH = Math.max(220, window.innerHeight * 0.52), s = Math.min(maxW / rw, maxH / rh), dpr = window.devicePixelRatio || 1;
      cw = Math.round(rw * s); ch = Math.round(rh * s);
      cvs.style.width = cw + 'px'; cvs.style.height = ch + 'px'; cvs.width = Math.round(cw * dpr); cvs.height = Math.round(ch * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, cw, ch); drawRot(ctx, cw, ch);
      const x = box.x * cw, y = box.y * ch, w = box.w * cw, h = box.h * ch;
      ctx.fillStyle = 'rgba(5,10,20,.55)'; ctx.fillRect(0, 0, cw, y); ctx.fillRect(0, y + h, cw, ch - y - h); ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, cw - x - w, h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.45)';
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1D4ED8'; ctx.lineWidth = 3;
      for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { ctx.beginPath(); ctx.arc(hx, hy, 11, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    const pos = e => { const r = cvs.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    cvs.style.touchAction = 'none';
    cvs.onpointerdown = e => {
      const [px, py] = pos(e), tx = 26 / cw, ty = 26 / ch, L = box.x, R = box.x + box.w, T = box.y, B = box.y + box.h;
      const nL = Math.abs(px - L) < tx, nR = Math.abs(px - R) < tx, nT = Math.abs(py - T) < ty, nB = Math.abs(py - B) < ty;
      const inside = px > L && px < R && py > T && py < B;
      if (nL || nR || nT || nB) drag = { l: nL, r: nR, t: nT, b: nB };
      else if (inside) drag = { move: true, dx: px - L, dy: py - T };
      else return;
      cvs.setPointerCapture(e.pointerId);
    };
    cvs.onpointermove = e => {
      if (!drag) return; const [px, py] = pos(e), min = 0.08, cl = v => Math.min(1, Math.max(0, v));
      let L = box.x, R = box.x + box.w, T = box.y, B = box.y + box.h;
      if (drag.move) { const nx = Math.min(1 - box.w, Math.max(0, px - drag.dx)), ny = Math.min(1 - box.h, Math.max(0, py - drag.dy)); box.x = nx; box.y = ny; }
      else { if (drag.l) L = Math.min(cl(px), R - min); if (drag.r) R = Math.max(cl(px), L + min); if (drag.t) T = Math.min(cl(py), B - min); if (drag.b) B = Math.max(cl(py), T + min); box = { x: L, y: T, w: R - L, h: B - T }; }
      draw();
    };
    cvs.onpointerup = cvs.onpointercancel = () => { drag = null; };
    const full = () => ({ x: 0, y: 0, w: 1, h: 1 });
    dlg.querySelector('#cLeft').onclick = () => { rot = (rot + 3) % 4; box = full(); layout(); };
    dlg.querySelector('#cRight').onclick = () => { rot = (rot + 1) % 4; box = full(); layout(); };
    dlg.querySelector('#cReset').onclick = () => { box = full(); draw(); };
    dlg.querySelector('#cAuto').onclick = () => { const b = rot === 0 ? autoCropBox(bmp) : null; if (b) { box = b; draw(); } else { box = full(); draw(); toast(rot ? 'Il ritaglio automatico funziona sulla foto non ruotata.' : 'Non riesco a trovare i bordi: trascinali tu.'); } };
    dlg.querySelector('#cCancel').onclick = () => { result = null; closeDlg(dlg); };
    dlg.querySelector('#cSkip').onclick = () => { result = file; closeDlg(dlg); };
    dlg.querySelector('#cOk').onclick = async () => {
      const [rw, rh] = dims(), k = Math.min(1, 2600 / Math.max(rw, rh)), W = Math.round(rw * k), H = Math.round(rh * k);
      const full_ = document.createElement('canvas'); full_.width = W; full_.height = H; drawRot(full_.getContext('2d'), W, H);
      const sx = Math.round(box.x * W), sy = Math.round(box.y * H), sw = Math.max(8, Math.round(box.w * W)), sh = Math.max(8, Math.round(box.h * H));
      const out = document.createElement('canvas'); out.width = sw; out.height = sh; out.getContext('2d').drawImage(full_, sx, sy, sw, sh, 0, 0, sw, sh);
      result = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92)); closeDlg(dlg);
    };
    dlg.onclose = () => { bmp.close?.(); res(result); };
    openDlg(dlg); requestAnimationFrame(layout);
    if (auto) dlg.querySelector('#cHint').textContent = 'Ho inquadrato il foglio in automatico. Controlla i bordi e correggi se serve.';
  });
}
