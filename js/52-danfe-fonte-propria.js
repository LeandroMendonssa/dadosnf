// 52-danfe-fonte-propria.js — Fonte PRÓPRIA do PDF do DANFE (2.31.0).
// Você carrega os arquivos .ttf da sua fonte (ex.: Times New Roman do Windows: times.ttf, timesbd.ttf, timesi.ttf). Eles ficam guardados
// só neste navegador (IndexedDB), nunca vão para o Firebase nem para o GitHub, e o PDF do DANFE passa a embutir essa fonte.
// Sem fonte carregada, o PDF continua usando a fonte padrão do app (Liberation Serif). Layout/medidas não mudam (mesmas larguras da Times).
(function () {
'use strict';
const CP1252_ALTO = [0x20AC,0,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,0x02C6,0x2030,0x0160,0x2039,0x0152,0,0x017D,0,0,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,0x02DC,0x2122,0x0161,0x203A,0x0153,0,0x017E,0x0178];
function unicodeDoCodigo(c) { if (c >= 128 && c <= 159) return CP1252_ALTO[c - 128]; if (c === 127) return 0; return c; }

// ---- leitura do TrueType ----
function lerTtf(buf) {
  const dv = new DataView(buf);
  const tag = dv.getUint32(0);
  if (tag === 0x74746366) throw new Error('Este arquivo é uma coleção de fontes (.ttc). Use o arquivo .ttf individual.');
  if (tag === 0x4F54544F) throw new Error('Esta fonte é do tipo OpenType com contornos CFF (.otf), que o PDF não aceita aqui. Use o arquivo .ttf.');
  if (tag !== 0x00010000 && tag !== 0x74727565) throw new Error('Arquivo não reconhecido como fonte TrueType (.ttf).');
  const nt = dv.getUint16(4), T = {};
  for (let i = 0; i < nt; i++) { const o = 12 + i * 16; T[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = { o: dv.getUint32(o + 8), l: dv.getUint32(o + 12) }; }
  ['head', 'hhea', 'hmtx', 'cmap', 'maxp'].forEach(t => { if (!T[t]) throw new Error('Fonte incompleta (falta a tabela ' + t + ').'); });
  if (T['OS/2'] && T['OS/2'].l >= 10) {
    const fsType = dv.getUint16(T['OS/2'].o + 8);
    if (fsType & 0x0002) throw new Error('A licença desta fonte não permite incorporá-la em PDF.');
  }
  const h = T.head.o, upm = dv.getUint16(h + 18) || 1000, k = 1000 / upm;
  const macStyle = dv.getUint16(h + 44);
  const bbox = [dv.getInt16(h + 36), dv.getInt16(h + 38), dv.getInt16(h + 40), dv.getInt16(h + 42)].map(v => Math.round(v * k));
  const hh = T.hhea.o, asc = Math.round(dv.getInt16(hh + 4) * k), desc = Math.round(dv.getInt16(hh + 6) * k), nHM = dv.getUint16(hh + 34);
  const numGlyphs = dv.getUint16(T.maxp.o + 4);
  const adv = g => { const i = Math.min(g, nHM - 1); return dv.getUint16(T.hmtx.o + i * 4); };
  // cmap: Unicode BMP (formato 4)
  const c0 = T.cmap.o, nsub = dv.getUint16(c0 + 2); let sub = -1;
  for (let i = 0; i < nsub; i++) {
    const pid = dv.getUint16(c0 + 4 + i * 8), eid = dv.getUint16(c0 + 6 + i * 8), off = dv.getUint32(c0 + 8 + i * 8);
    if (dv.getUint16(c0 + off) === 4 && ((pid === 3 && eid === 1) || pid === 0)) { sub = c0 + off; if (pid === 3) break; }
  }
  if (sub < 0) throw new Error('A fonte não tem o mapa de caracteres Unicode esperado.');
  const segX2 = dv.getUint16(sub + 6), seg = segX2 / 2, endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const glifo = u => {
    for (let s = 0; s < seg; s++) {
      if (u <= dv.getUint16(endO + s * 2)) {
        const st = dv.getUint16(startO + s * 2); if (u < st) return 0;
        const ro = dv.getUint16(rangeO + s * 2), dl = dv.getInt16(deltaO + s * 2);
        if (ro === 0) return (u + dl) & 0xFFFF;
        const p = rangeO + s * 2 + ro + (u - st) * 2; const g = dv.getUint16(p); return g ? (g + dl) & 0xFFFF : 0;
      }
    }
    return 0;
  };
  const w = [];
  for (let c = 32; c <= 255; c++) { const u = unicodeDoCodigo(c); const g = u ? glifo(u) : 0; w.push(g && g < numGlyphs ? Math.round(adv(g) * k) : 0); }
  let ital = 0; if (T.post && T.post.l >= 8) { ital = dv.getInt32(T.post.o + 4) / 65536; ital = Math.round(ital * 100) / 100; }
  // nome (ID 4, plataforma 3)
  let nome = '';
  if (T.name) {
    const n0 = T.name.o, cnt = dv.getUint16(n0 + 2), so = n0 + dv.getUint16(n0 + 4);
    for (let i = 0; i < cnt; i++) {
      const r = n0 + 6 + i * 12;
      if (dv.getUint16(r) === 3 && dv.getUint16(r + 6) === 4) { const len = dv.getUint16(r + 8), off = dv.getUint16(r + 10); for (let j = 0; j < len; j += 2) nome += String.fromCharCode(dv.getUint16(so + off + j)); break; }
    }
  }
  const estilo = (macStyle & 1 ? 'B' : '') + (macStyle & 2 ? 'I' : '');
  return { w, bbox, asc, desc, ital, nome, estilo };
}
function paraBinario(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return s; }

// ---- guarda no navegador ----
function abrirDb() { return new Promise((ok, no) => { try { const r = indexedDB.open('danfeFonteV1', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }); }
async function dbLer() { const db = await abrirDb(); return new Promise((ok, no) => { const o = {}; const rq = db.transaction('f').objectStore('f').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { o[c.key] = c.value; c.continue(); } else ok(o); }; rq.onerror = () => no(rq.error); }); }
async function dbGravar(k, v) { const db = await abrirDb(); return new Promise((ok, no) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = ok; t.onerror = () => no(t.error); }); }
async function dbLimpar() { const db = await abrirDb(); return new Promise((ok, no) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').clear(); t.oncomplete = ok; t.onerror = () => no(t.error); }); }

function montar(reg) { // reg: {R:{buf,nome}, B:..., I:...} -> window.DANFE_FONTES_USUARIO (precisa de regular e negrito)
  const out = {};
  ['R', 'B', 'I'].forEach(k => {
    if (!reg[k]) return;
    try { const m = lerTtf(reg[k].buf); out[k] = { bin: paraBinario(reg[k].buf), w: m.w, bbox: m.bbox, asc: m.asc, desc: m.desc, ital: k === 'I' ? (m.ital || -12) : 0, nome: m.nome || reg[k].nome || 'Fonte' }; } catch (e) { console.warn('fonte ' + k, e); }
  });
  window.DANFE_FONTES_USUARIO = (out.R && out.B) ? out : null;
  return window.DANFE_FONTES_USUARIO;
}
window.danfeFontesProntas = (async () => { try { montar(await dbLer()); } catch (e) { window.DANFE_FONTES_USUARIO = null; } })();

const ROT = { R: 'Normal', B: 'Negrito', I: 'Itálico' };
async function danfeFonteRender() {
  const el = document.getElementById('danfe-fonte-estado'); if (!el) return;
  let reg = {}; try { reg = await dbLer(); } catch (e) { el.innerHTML = '<p class="desc-tela">Este navegador não permite guardar a fonte (modo privado?). O PDF continua com a fonte padrão.</p>'; return; }
  const ativa = !!(reg.R && reg.B);
  el.innerHTML = `<div style="font-size:14px;margin-bottom:8px"><b>${ativa ? 'Usando a sua fonte' : 'Usando a fonte padrão do app'}</b></div>` +
    ['R', 'B', 'I'].map(k => `<div style="font-size:13px;color:var(--text-light);padding:2px 0">${ROT[k]}: ${reg[k] ? escRel(reg[k].nome || 'carregada') : '—'}</div>`).join('') +
    (reg.R && !reg.B ? '<div style="font-size:13px;margin-top:8px;color:var(--danger)">Falta o arquivo Negrito: sem ele a fonte padrão continua sendo usada.</div>' : '');
}
async function danfeFonteCarregar(input) {
  const arqs = Array.from(input.files || []); input.value = '';
  if (!arqs.length) return;
  const st = document.getElementById('danfe-fonte-msg'); const msg = t => { if (st) st.textContent = t; };
  let ok = 0, erros = [];
  for (const f of arqs) {
    try {
      const buf = await f.arrayBuffer(); const m = lerTtf(buf);
      const k = m.estilo === 'B' ? 'B' : (m.estilo === 'I' || m.estilo === 'BI') ? 'I' : 'R';
      if (m.estilo === 'BI') { erros.push(f.name + ': negrito-itálico não é usado; ignorado.'); continue; }
      await dbGravar(k, { buf, nome: m.nome || f.name }); ok++;
    } catch (e) { erros.push(f.name + ': ' + (e && e.message || 'erro')); }
  }
  try { montar(await dbLer()); } catch (e) {}
  msg((ok ? ok + ' arquivo(s) carregado(s). ' : '') + erros.join(' '));
  danfeFonteRender();
}
async function danfeFonteRemover() { try { await dbLimpar(); } catch (e) {} window.DANFE_FONTES_USUARIO = null; const st = document.getElementById('danfe-fonte-msg'); if (st) st.textContent = 'Voltou para a fonte padrão do app.'; danfeFonteRender(); }
window.danfeFonteRender = danfeFonteRender; window.danfeFonteCarregar = danfeFonteCarregar; window.danfeFonteRemover = danfeFonteRemover; window.danfeLerTtf = lerTtf;
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/52-danfe-fonte-propria.js'] = '2.31.0';
