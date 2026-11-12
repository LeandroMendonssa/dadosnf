// 49-danfe.js — Gera o DANFE (PDF no padrão da Sefaz) direto do XML ORIGINAL da NF-e (2.26.0).
// Usa o texto do XML exatamente como foi carregado (xmlTextoAtual): quantidades, unidades e valores saem como o fornecedor emitiu,
// sem o fator de conversão do app. O PDF é escrito aqui mesmo (fonte Times padrão, sem biblioteca externa). Não grava nada no Firebase.
(function () {
'use strict';
const WID = {"R":[250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,761,500,0,333,500,444,1000,500,500,333,1000,556,333,889,0,611,0,0,333,333,444,444,350,500,1000,333,980,389,333,722,0,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500],"B":[250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,761,500,0,333,500,500,1000,500,500,333,1000,556,333,1000,0,667,0,0,333,333,500,500,350,500,1000,333,1000,389,333,722,0,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500],"I":[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,761,500,0,333,500,556,889,500,500,333,1000,500,333,944,0,556,0,0,333,333,556,556,350,500,889,333,980,389,333,667,0,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444]};
const MMPT = 25.4 / 72;
const CP1252 = { '€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8A,'‹':0x8B,'Œ':0x8C,'Ž':0x8E,
  '‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9A,'›':0x9B,'œ':0x9C,'ž':0x9E,'Ÿ':0x9F };
function codeOf(ch) { const c = ch.charCodeAt(0); if (c >= 32 && c < 127) return c; if (c >= 160 && c <= 255) return c; return CP1252[ch] || 63; }
function wmm(str, st, size) { const t = WID[st]; let s = 0; for (const ch of String(str)) { const c = codeOf(ch); s += t[c - 32] || 0; } return s * size / 1000 * MMPT; }

/* ============ Saída 1: PDF escrito à mão (Times padrão, linhas, retângulos) ============ */
function PdfOut() {
  const pages = []; let ops = null; let gcur = '';
  const F = { R: 'F1', B: 'F2', I: 'F3' };
  const n2 = v => (Math.round(v * 100) / 100).toString();
  const X = v => n2(v / MMPT), Y = v => n2((297 - v) / MMPT);
  function esc(str) { let o = ''; for (const ch of String(str)) { const c = codeOf(ch); if (c === 40 || c === 41 || c === 92) o += '\\' + ch; else if (c < 127) o += String.fromCharCode(c); else o += '\\' + c.toString(8).padStart(3, '0'); } return o; }
  this.addPage = () => { ops = []; pages.push(ops); };
  this.stroke = (gray, wmmv, dash) => { ops.push(n2(gray) + ' G ' + n2(wmmv / MMPT) + ' w ' + (dash ? '[' + n2(dash[0] / MMPT) + ' ' + n2(dash[1] / MMPT) + '] 0 d' : '[] 0 d')); };
  this.text = (s, x, y, st, size) => { if (s === '' || s == null) return; ops.push('BT /' + F[st] + ' ' + n2(size) + ' Tf ' + X(x) + ' ' + Y(y) + ' Td (' + esc(s) + ') Tj ET'); };
  this.line = (x1, y1, x2, y2) => { ops.push(X(x1) + ' ' + Y(y1) + ' m ' + X(x2) + ' ' + Y(y2) + ' l S'); };
  this.rrect = (x, y, w, h, r) => {
    const k = 0.5523 * r, x2 = x + w, y2 = y + h, p = (a, b) => X(a) + ' ' + Y(b);
    ops.push(p(x + r, y) + ' m ' + p(x2 - r, y) + ' l ' + p(x2 - r + k, y) + ' ' + p(x2, y + r - k) + ' ' + p(x2, y + r) + ' c ' + p(x2, y2 - r) + ' l ' +
      p(x2, y2 - r + k) + ' ' + p(x2 - r + k, y2) + ' ' + p(x2 - r, y2) + ' c ' + p(x + r, y2) + ' l ' + p(x + r - k, y2) + ' ' + p(x, y2 - r + k) + ' ' + p(x, y2 - r) + ' c ' +
      p(x, y + r) + ' l ' + p(x, y + r - k) + ' ' + p(x + r - k, y) + ' ' + p(x + r, y) + ' c S');
  };
  this.bar = (x, y, w, h) => { ops.push('0 g ' + X(x) + ' ' + Y(y + h) + ' ' + n2(w / MMPT) + ' ' + n2(h / MMPT) + ' re f'); };
  this.finish = () => {
    const objs = []; const add = s => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(null);   // 2: Pages, preenchido depois
    // Fonte embutida (Liberation Serif, js/50): o PDF aparece igual em qualquer leitor. Sem ela, cai nas fontes Times padrão do PDF.
    const FT = (typeof window !== 'undefined' && window.DANFE_FONTES) || null;
    const FU = (typeof window !== 'undefined' && window.DANFE_FONTES_USUARIO) || null; // 2.31.0: fonte própria carregada pelo usuário (js/52)
    const fonts = ['R', 'B', 'I'].map((k, i) => {
      const f = (FU && FU[k]) || (FT && FT[k]);
      if (!f) return add('<< /Type /Font /Subtype /Type1 /BaseFont /' + ['Times-Roman', 'Times-Bold', 'Times-Italic'][i] + ' /Encoding /WinAnsiEncoding >>');
      const bin = f.bin || atob(f.b64), tag = 'DNFE' + 'RBI'[i] + 'X+' + (f.bin ? 'FontePropria' : 'LiberationSerif') + ['', '-Bold', '-Italic'][i];
      const ff = add('<< /Length ' + bin.length + ' /Length1 ' + bin.length + ' >>\nstream\n' + bin + '\nendstream');
      const fd = add('<< /Type /FontDescriptor /FontName /' + tag + ' /Flags ' + (k === 'I' ? 98 : 34) + ' /FontBBox [' + f.bbox.join(' ') + '] /ItalicAngle ' + f.ital + ' /Ascent ' + f.asc + ' /Descent ' + f.desc + ' /CapHeight 662 /StemV ' + (k === 'B' ? 140 : 80) + ' /FontFile2 ' + ff + ' 0 R >>');
      return add('<< /Type /Font /Subtype /TrueType /BaseFont /' + tag + ' /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [' + f.w.join(' ') + '] /FontDescriptor ' + fd + ' 0 R >>');
    });
    const kids = [];
    pages.forEach(p => {
      const body = '0 g 0 G\n' + p.join('\n');
      const c = add('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream');
      const pg = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ' + fonts[0] + ' 0 R /F2 ' + fonts[1] + ' 0 R /F3 ' + fonts[2] + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
      kids.push(pg + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    const info = add('<< /Producer (App Auditoria NF) /Title (DANFE) >>');
    let out = '%PDF-1.4\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xr = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF';
    const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255; return u;
  };
}

/* ============ Saída 2: prévia em canvas (mesmas chamadas) ============ */
function CanvasOut(pxPerMm) {
  const cvs = []; let ctx = null; let st = { g: 0, w: 0.1, d: null };
  this.canvases = cvs;
  this.addPage = () => { const c = document.createElement('canvas'); c.width = Math.round(210 * pxPerMm); c.height = Math.round(297 * pxPerMm); ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); cvs.push(c); };
  const P = v => v * pxPerMm;
  const gray = g => { const v = Math.round(g * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; };
  this.stroke = (g, w, d) => { st = { g, w, d }; ctx.strokeStyle = gray(g); ctx.lineWidth = Math.max(P(w), 1); ctx.setLineDash(d ? [P(d[0]), P(d[1])] : []); };
  this.text = (s, x, y, style, size) => {
    if (s === '' || s == null) return;
    ctx.fillStyle = '#000'; ctx.font = (style === 'B' ? 'bold ' : '') + (style === 'I' ? 'italic ' : '') + (size * MMPT * pxPerMm) + 'px "Times New Roman", Times, "Liberation Serif", serif';
    ctx.textBaseline = 'alphabetic'; ctx.fillText(String(s), P(x), P(y));
  };
  this.line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(P(x1), P(y1)); ctx.lineTo(P(x2), P(y2)); ctx.stroke(); };
  this.rrect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(P(x), P(y), P(w), P(h), P(r)); ctx.stroke(); };
  this.bar = (x, y, w, h) => { ctx.fillStyle = '#000'; ctx.fillRect(P(x), P(y), P(w), P(h)); };
}

/* ============ Código de barras Code 128, conjunto C (chave de 44 dígitos) ============ */
const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ');
function code128c(digits) {
  const codes = [105]; for (let i = 0; i < digits.length; i += 2) codes.push(parseInt(digits.substr(i, 2), 10));
  let sum = 105; for (let i = 1; i < codes.length; i++) sum += codes[i] * i; codes.push(sum % 103);
  return codes.map(c => C128[c]).join('') + '2331112';   // padrão de largura das barras e espaços, módulo a módulo
}

/* ============ Leitura do XML da NF-e ============ */
function lerNFe(texto) {
  texto = String(texto == null ? '' : texto).replace(/^﻿/, '').replace(/^[\s\u0000]+/, '');
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Esse arquivo não é um XML válido. O conteúdo precisa começar com <?xml ou <nfeProc.');
  const inf = doc.querySelector('infNFe');
  if (!inf) throw new Error('Não encontrei uma NF-e (infNFe) neste XML. Pode ser outro tipo de arquivo.');
  const q = (n, sel) => { const e = n && n.querySelector(sel); return e ? e.textContent.trim() : ''; };
  const ide = inf.querySelector('ide'), emit = inf.querySelector('emit'), dest = inf.querySelector('dest');
  const prot = doc.querySelector('protNFe infProt');
  const chave = (prot && q(prot, 'chNFe')) || (inf.getAttribute('Id') || '').replace(/\D/g, '');
  const loc = n => n ? { nome: q(n, 'xNome'), doc: q(n, 'CNPJ') || q(n, 'CPF'), ie: q(n, 'IE'), lgr: q(n, 'xLgr'), nro: q(n, 'nro'), cpl: q(n, 'xCpl'), bairro: q(n, 'xBairro'), mun: q(n, 'xMun'), uf: q(n, 'UF'), cep: q(n, 'CEP'), fone: q(n, 'fone') } : null;
  const dts = ide ? (q(ide, 'dhEmi') || q(ide, 'dEmi')) : '', sai = ide ? (q(ide, 'dhSaiEnt') || q(ide, 'dSaiEnt')) : '';
  const tot = inf.querySelector('total ICMSTot'); const T = k => q(tot, k);
  const tr = inf.querySelector('transp'); const trp = tr && tr.querySelector('transporta'); const vol = tr && tr.querySelector('vol'); const vei = tr && tr.querySelector('veicTransp');
  const itens = [...inf.querySelectorAll('det')].map(det => {
    const p = det.querySelector('prod'), icms = det.querySelector('imposto ICMS'), ipi = det.querySelector('imposto IPI');
    const ic = icms && icms.firstElementChild;
    return { cod: q(p, 'cProd'), nome: q(p, 'xProd'), ncm: q(p, 'NCM'), cfop: q(p, 'CFOP'), un: q(p, 'uCom'), qtd: q(p, 'qCom'), vun: q(p, 'vUnCom'), vtot: q(p, 'vProd'), vdesc: q(p, 'vDesc'),
      cst: ic ? (q(ic, 'orig') + '/' + (q(ic, 'CST') || q(ic, 'CSOSN'))) : '', bc: ic ? q(ic, 'vBC') : '', vicms: ic ? q(ic, 'vICMS') : '', picms: ic ? q(ic, 'pICMS') : '',
      vipi: ipi ? q(ipi, 'vIPI') : '', pipi: ipi ? q(ipi, 'pIPI') : '', adic: q(det, 'infAdProd'),
      rastros: [...p.querySelectorAll('rastro')].map(r => ({ lote: q(r, 'nLote'), qtd: q(r, 'qLote'), fab: q(r, 'dFab'), val: q(r, 'dVal') })) };
  });
  return {
    chave, nNF: ide ? q(ide, 'nNF') : '', serie: ide ? q(ide, 'serie') : '', tpNF: ide ? q(ide, 'tpNF') : '1', natOp: ide ? q(ide, 'natOp') : '', dhEmi: dts, dhSai: sai,
    emit: Object.assign(loc(emit.querySelector('enderEmit') ? emit : emit) || {}, { nome: q(emit, 'xNome'), doc: q(emit, 'CNPJ') || q(emit, 'CPF'), ie: q(emit, 'IE'), iest: q(emit, 'IEST'), im: q(emit, 'IM'),
      lgr: q(emit, 'enderEmit xLgr'), nro: q(emit, 'enderEmit nro'), cpl: q(emit, 'enderEmit xCpl'), bairro: q(emit, 'enderEmit xBairro'), mun: q(emit, 'enderEmit xMun'), uf: q(emit, 'enderEmit UF'), cep: q(emit, 'enderEmit CEP'), fone: q(emit, 'enderEmit fone') }),
    dest: dest ? { nome: q(dest, 'xNome'), doc: q(dest, 'CNPJ') || q(dest, 'CPF'), ie: q(dest, 'IE'), lgr: q(dest, 'enderDest xLgr'), nro: q(dest, 'enderDest nro'), cpl: q(dest, 'enderDest xCpl'), bairro: q(dest, 'enderDest xBairro'), mun: q(dest, 'enderDest xMun'), uf: q(dest, 'enderDest UF'), cep: q(dest, 'enderDest CEP'), fone: q(dest, 'enderDest fone') } : {},
    entrega: loc(inf.querySelector('entrega')) || loc(inf.querySelector('retirada')), entregaTitulo: inf.querySelector('entrega') ? 'INFORMAÇÕES DO LOCAL DE ENTREGA' : 'INFORMAÇÕES DO LOCAL DE RETIRADA',
    dups: [...inf.querySelectorAll('cobr dup')].map(d => ({ n: q(d, 'nDup'), v: q(d, 'dVenc'), valor: q(d, 'vDup') })),
    tot: { bc: T('vBC'), icms: T('vICMS'), bcst: T('vBCST'), st: T('vST'), imp: T('vII'), remet: T('vICMSUFRemet'), fcp: T('vFCPUFDest'), pis: T('vPIS'), prod: T('vProd'), frete: T('vFrete'), seg: T('vSeg'), desc: T('vDesc'), outro: T('vOutro'), ipi: T('vIPI'), dest: T('vICMSUFDest'), trib: T('vTotTrib'), cofins: T('vCOFINS'), nf: T('vNF') },
    transp: { mod: tr ? q(tr, 'modFrete') : '9', nome: trp ? q(trp, 'xNome') : '', doc: trp ? (q(trp, 'CNPJ') || q(trp, 'CPF')) : '', ie: trp ? q(trp, 'IE') : '', end: trp ? q(trp, 'xEnder') : '', mun: trp ? q(trp, 'xMun') : '', uf: trp ? q(trp, 'UF') : '',
      placa: vei ? q(vei, 'placa') : '', ufv: vei ? q(vei, 'UF') : '', antt: vei ? q(vei, 'RNTC') : '', qvol: vol ? q(vol, 'qVol') : '', esp: vol ? q(vol, 'esp') : '', marca: vol ? q(vol, 'marca') : '', nvol: vol ? q(vol, 'nVol') : '', pesoB: vol ? q(vol, 'pesoB') : '', pesoL: vol ? q(vol, 'pesoL') : '' },
    itens, infCpl: q(inf, 'infAdic infCpl'), infFisco: q(inf, 'infAdic infAdFisco'), nProt: prot ? q(prot, 'nProt') : '', dhRecbto: prot ? q(prot, 'dhRecbto') : ''
  };
}

/* ============ Formatação ============ */
const num = (v, d) => { const n = parseFloat(v); if (isNaN(n)) return ''; return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const mdate = s => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const mtime = s => { const m = String(s || '').match(/T(\d{2}:\d{2}:\d{2})/); return m ? m[1] : ''; };
const cnpj = s => { s = String(s || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : s.length === 11 ? s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : s; };
const cep = s => { s = String(s || '').replace(/\D/g, ''); return s.length === 8 ? s.slice(0, 5) + '-' + s.slice(5) : s; };
const nf9 = s => { s = String(s || '').padStart(9, '0'); return s.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3'); };
const MODFRETE = { '0': '0-Por conta do Emit', '1': '1-Por conta do Dest', '2': '2-Por conta de Terceiros', '3': '3-Próprio Rem', '4': '4-Próprio Dest', '9': '9-Sem Frete' };

/* ============ Desenho do DANFE (A4, medidas em mm, iguais ao PDF de exemplo) ============ */
function wrap(str, maxW, st, size) {
  const out = [];
  String(str).split('\n').forEach(par => {
    let cur = '';
    par.split(' ').forEach(w => {
      let t = cur ? cur + ' ' + w : w;
      if (wmm(t, st, size) <= maxW) { cur = t; return; }
      if (cur) { out.push(cur); cur = ''; }
      while (wmm(w, st, size) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && wmm(w.slice(0, k), st, size) > maxW) k--; out.push(w.slice(0, k)); w = w.slice(k); }
      cur = w;
    });
    out.push(cur);
  });
  return out;
}
function desenharDanfe(d, S, opt) {
  const L = 2, R = 208, TXT = (s, x, y, st, size) => S.text(s, x, y, st || 'R', size || 8);
  const gray = (g, w, dash) => S.stroke(g, w, dash);
  const thin = () => gray(0, 0.1, null);
  const box = (x0, y0, x1, y1) => { thin(); S.rrect(x0, y0, x1 - x0, y1 - y0, 0.8); };
  const centro = (s, x0, x1, y, st, size) => { const w = wmm(s, st, size); TXT(s, Math.max(x0 + 0.2, (x0 + x1) / 2 - w / 2), y, st, size); };
  const direita = (s, x1, y, st, size) => TXT(s, x1 - 0.5 - wmm(s, st, size), y, st, size);
  const rot = (s, x0, y0, size) => TXT(s, x0 + 0.5, y0 + 2.12, 'R', size || 6);
  const campo = (x0, y0, x1, y1, rotulo, val, modo, st, size, rs) => {
    box(x0, y0, x1, y1); rot(rotulo, x0, y0, rs || 6);
    if (val === '' || val == null) return;
    val = String(val); const f = st || 'B', sz0 = size || 10, larg = x1 - x0 - 1.2;
    let sz = sz0; while (sz > 6 && wmm(val, f, sz) > larg) sz -= 0.5;
    if (wmm(val, f, sz) > larg) {   // não cabe nem reduzido: quebra em até 2 linhas dentro da caixa
      const ls = wrap(val, larg, f, 6.5).slice(0, 2);
      ls.forEach((s, i) => TXT(s, x0 + 0.5, y0 + (ls.length > 1 ? 4.5 : 6.5) + i * 2.3, f, 6.5));
      return;
    }
    const yy = y0 + 6.5;
    if (modo === 'l') TXT(val, x0 + 0.5, yy, f, sz); else if (modo === 'r') direita(val, x1, yy, f, sz); else centro(val, x0, x1, yy, f, sz);
  };
  const titulo = (s, y) => TXT(s, L + 0.5, y, 'B', 7);
  const e = d.emit, ds = d.dest;
  const endLinha = o => [o.lgr + (o.nro ? ', ' + o.nro : ''), o.cpl ? ' - ' + o.cpl : ''].join('');
  const emitL1 = e.lgr + (e.nro ? ', ' + e.nro : '') + (e.cpl ? ' - ' + e.cpl : '');
  const emitL2 = (e.bairro ? e.bairro + ' - ' : '') + cep(e.cep);
  const emitL3 = e.mun + ' - ' + e.uf + (e.fone ? ' Fone/Fax: ' + e.fone : '');
  const numTxt = 'Nº. ' + nf9(d.nNF), serTxt = 'Série ' + String(d.serie).padStart(3, '0');

  /* ---- cabeçalho comum (emitente, DANFE, chave, natureza, inscrições) ---- */
  function blocoEmitente(y0, folha, total) {
    box(L, y0, 86, y0 + 32);
    centro('IDENTIFICAÇÃO DO EMITENTE', L, 86, y0 + 2.12, 'I', 6);
    const ls = [emitL1, emitL2, emitL3].filter(Boolean), desl = (3 - ls.length) * 1.41, LW = 82;
    let nsz = 12; while (nsz > 9 && wmm(e.nome, 'B', nsz) > LW) nsz -= 0.5;
    const nl = wrap(e.nome, LW, 'B', nsz).slice(0, 2);
    if (nl.length === 1) centro(nl[0], L, 86, y0 + 15.23 + desl, 'B', nsz);
    else nl.forEach((s, i) => centro(s, L, 86, y0 + 12.9 + i * 4 + desl / 2, 'B', nsz));
    const ay = nl.length === 1 ? y0 + 18.82 + desl : y0 + 20.9 + desl / 2;
    ls.forEach((s, i) => { let sz = 8; while (sz > 6 && wmm(s, 'R', sz) > LW) sz -= 0.5; centro(s, L, 86, ay + i * 2.82, 'R', sz); });
    box(86, y0, 121, y0 + 32);
    centro('DANFE', 86, 121, y0 + 5.94, 'B', 14);
    centro('Documento Auxiliar da Nota', 86, 121, y0 + 8.82, 'R', 8);
    centro('Fiscal Eletrônica', 86, 121, y0 + 11.64, 'R', 8);
    TXT('0 - ENTRADA', 88.5, y0 + 16.82, 'R', 8); TXT('1 - SAÍDA', 88.5, y0 + 19.82, 'R', 8);
    box(113, y0 + 13, 118, y0 + 20); centro(d.tpNF === '0' ? '0' : '1', 113, 118, y0 + 18.62, 'B', 12);
    centro(numTxt, 86, 121, y0 + 25.26, 'B', 10); centro(serTxt, 86, 121, y0 + 28.26, 'B', 10); centro('Folha ' + folha + '/' + total, 86, 121, y0 + 30.91, 'I', 8);
    box(121, y0, 208, y0 + 32);
    // código de barras (módulo 0,27 mm, 12 mm de altura)
    const pad = code128c(d.chave.replace(/\D/g, '').padEnd(44, '0').slice(0, 44)), mod = 0.27009;
    let tw = 0; for (const c of pad) tw += +c; tw *= mod;
    let x = 121 + (87 - tw) / 2, bar = true;
    for (const c of pad) { const w = +c * mod; if (bar) S.bar(x, y0 + 2, w, 12); x += w; bar = !bar; }
    thin(); S.line(121, y0 + 16, 208, y0 + 16); S.line(121, y0 + 24, 208, y0 + 24);
    TXT('CHAVE DE ACESSO', 121.5, y0 + 18.12, 'R', 6);
    centro(d.chave.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 '), 121, 208, y0 + 22.82, 'B', 8);
    centro('Consulta de autenticidade no portal nacional da NF-e', 121, 208, y0 + 26.82, 'R', 8);
    centro('www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', 121, 208, y0 + 30.82, 'R', 8);
    campo(L, y0 + 32, 121, y0 + 39, 'NATUREZA DA OPERAÇÃO', d.natOp);
    campo(121, y0 + 32, R, y0 + 39, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', d.nProt ? d.nProt + '  -  ' + mdate(d.dhRecbto) + ' ' + mtime(d.dhRecbto) : '');
    campo(L, y0 + 39, 54, y0 + 46, 'INSCRIÇÃO ESTADUAL', e.ie);
    campo(54, y0 + 39, 106, y0 + 46, 'INSCRIÇÃO MUNICIPAL', e.im);
    campo(106, y0 + 39, 158, y0 + 46, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', e.iest);
    campo(158, y0 + 39, R, y0 + 46, 'CNPJ / CPF', cnpj(e.doc));
    return y0 + 46;
  }

  /* ---- paginação dos itens ---- */
  const LH = 2.47, rowH = n => n * LH + 1.0;
  const COLS = [2, 21, 73, 85, 95, 103, 109, 125, 137, 149, 159, 171, 183, 193, 201, 208];
  const itens = d.itens.map(it => {
    const adic = opt.nLiteral ? it.adic.replace(/\\n/g, '\n') : it.adic;
    // lote/validade estruturados (<rastro>), como o DANFE oficial: "Lote: X Qtde: N Fab: dd/mm/aaaa Val: dd/mm/aaaa" (valores como vieram no XML)
    const rast = (it.rastros || []).filter(r => r.lote).map(r => 'Lote:\u00A0' + r.lote + (r.qtd ? ' Qtde:\u00A0' + num(r.qtd, 3) : '') + (r.fab ? ' Fab:\u00A0' + mdate(r.fab) : '') + (r.val ? ' Val:\u00A0' + mdate(r.val) : ''));   // espaço fixo: o rótulo não se separa do valor na quebra de linha
    const linhas = wrap(it.nome, 51, 'R', 7).concat(adic ? wrap(adic, 51, 'R', 7) : [], ...rast.map(s => wrap(s, 51, 'R', 7)));
    return { it, linhas, h: rowH(Math.max(1, linhas.length)) };
  });
  const FIRST_TOP = 183, BOT_FULL = 272, BOT_CONT = 289.5, ADIC_Y = 278;
  const total = itens.reduce((s, r) => s + r.h, 0);
  // páginas seguintes começam logo abaixo do cabeçalho (2+46 = 48 + título): recalcula o topo da tabela e refaz a divisão com o espaço real
  const TOP_CONT = 2 + 46 + 6 + 5;   // cabeçalho, título da seção e linha de títulos das colunas
  const pg = []; { let atual = []; let y = FIRST_TOP; let bot = (FIRST_TOP + total > BOT_FULL) ? BOT_CONT : BOT_FULL; let primeira = true;
    itens.forEach(r => { if (y + r.h > bot && atual.length) { pg.push(atual); atual = []; y = TOP_CONT; bot = BOT_CONT; primeira = false; } atual.push(r); y += r.h; });
    pg.push(atual);
    // a última página precisa caber os dados adicionais: se as linhas passam de 272, abre mais uma página só para eles
    const ultimaTop = pg.length === 1 ? FIRST_TOP : TOP_CONT; const ultimaH = pg[pg.length - 1].reduce((s, r) => s + r.h, 0);
    if (pg.length > 1 && ultimaTop + ultimaH > BOT_FULL) pg.push([]);
  }
  const NP = pg.length;

  function cabecalhoTabela(yT, yB) {
    box(L, yT, R, yB);
    const nomes = [['CÓDIGO PRODUTO'], ['DESCRIÇÃO DO PRODUTO / SERVIÇO'], ['NCM/SH'], ['O/CST'], ['CFOP'], ['UN'], ['QUANT'], ['VALOR', 'UNIT'], ['VALOR', 'TOTAL'], ['VALOR', 'DESC'], ['B.CÁLC', 'ICMS'], ['VALOR', 'ICMS'], ['VALOR', 'IPI'], ['ALÍQ.', 'ICMS'], ['ALÍQ.', 'IPI']];
    nomes.forEach((n, i) => { const a = COLS[i], b = COLS[i + 1]; if (n.length === 1) centro(n[0], a, b, yT + 3.06, 'R', 6); else { centro(n[0], a, b, yT + 2.0, 'R', 6); centro(n[1], a, b, yT + 4.12, 'R', 6); } });
    thin(); S.line(L, yT + 5, R, yT + 5);
    gray(0.588, 0.1, [1, 2]); COLS.slice(1, -1).forEach(x => S.line(x, yT, x, yB));
  }
  function linhasItens(rows, y) {
    rows.forEach((r, idx) => {
      gray(0.431, 0.1, [2, 0.575]); S.line(L, y, 207.28, y);
      const it = r.it, t1 = y + LH;
      let sz = 7; while (sz > 5 && wmm(it.cod, 'R', sz) > 18) sz -= 0.5;
      centro(it.cod, COLS[0], COLS[1], t1, 'R', sz);
      r.linhas.forEach((s, i) => TXT(s, 21.5, t1 + i * LH, 'R', 7));
      centro(it.ncm, COLS[2], COLS[3], t1, 'R', 7); centro(it.cst, COLS[3], COLS[4], t1, 'R', 7); centro(it.cfop, COLS[4], COLS[5], t1, 'R', 7); centro(it.un, COLS[5], COLS[6], t1, 'R', 7);
      const dir = (s, i) => direita(s, COLS[i + 1], t1, 'R', 7);
      dir(num(it.qtd, 4), 6); dir(num(it.vun, 4), 7); dir(num(it.vtot, 2), 8); dir(num(it.vdesc || 0, 2), 9); dir(num(it.bc, 2), 10); dir(num(it.vicms, 2), 11); dir(it.vipi ? num(it.vipi, 2) : '', 12);
      centro(it.picms ? num(it.picms, 2) : '', COLS[13], COLS[14], t1, 'R', 7); centro(it.pipi ? num(it.pipi, 2) : '', COLS[14], COLS[15], t1, 'R', 7);
      y += r.h;
    });
    thin();
  }
  function adicionais() {
    titulo('DADOS ADICIONAIS', 277.47);
    box(L, ADIC_Y, 138, 293); TXT('INFORMAÇÕES COMPLEMENTARES', L + 0.5, 280.12, 'B', 6);
    let sz = 8, step = 2.82, ls = wrap(d.infCpl, 135, 'R', sz), maxL = 3;
    if (ls.length > maxL) { sz = 6.5; step = 2.3; ls = wrap(d.infCpl, 135, 'R', sz); maxL = 5; }
    ls.slice(0, maxL).forEach((s, i) => TXT(i === maxL - 1 && ls.length > maxL ? s.replace(/\s*\S*$/, '…') : s, L + 0.5, 283.82 + i * step, 'R', sz));
    box(138, ADIC_Y, R, 293); TXT('RESERVADO AO FISCO', 138.5, 280.12, 'B', 6);
    wrap(d.infFisco, 68, 'R', 7).slice(0, 4).forEach((s, i) => TXT(s, 138.5, 282.47 + i * 2.82, 'R', 7));
  }
  function rodape() { const n = new Date(), p = v => String(v).padStart(2, '0'); TXT('Impresso em ' + p(n.getDate()) + '/' + p(n.getMonth() + 1) + '/' + n.getFullYear() + ' às ' + p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds()), L + 0.5, 295.12, 'I', 6); }

  /* ---- página 1 ---- */
  S.addPage(); thin();
  box(L, 2, 169, 12);
  const canh = 'RECEBEMOS DE ' + e.nome + ' OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ' + mdate(d.dhEmi) + ' VALOR TOTAL: R$ ' + num(d.tot.nf, 2) +
    ' DESTINATÁRIO: ' + ds.nome + ' - ' + endLinha(ds) + ' ' + ds.bairro + ' ' + ds.mun + '-' + ds.uf;
  wrap(canh, 164.5, 'R', 7).slice(0, 3).forEach((s, i) => TXT(s, 2.5, 5.76 + i * 2.47, 'R', 7));
  box(169, 2, R, 20); centro('NF-e', 169, R, 6.94, 'B', 14); centro(numTxt, 169, R, 12.76, 'B', 10); centro(serTxt, 169, R, 16.29, 'B', 10);
  box(L, 12, 37, 20); TXT('DATA DE RECEBIMENTO', 2.5, 14.12, 'R', 6);
  box(37, 12, 169, 20); TXT('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', 37.5, 14.12, 'R', 6);
  gray(0.431, 0.1, [2, 0.575]); S.line(L, 21, 207.43, 21); thin();
  blocoEmitente(23, 1, NP);

  titulo('DESTINATÁRIO / REMETENTE', 72.47);
  campo(L, 73, 128, 80, 'NOME / RAZÃO SOCIAL', ds.nome, 'l'); campo(128, 73, 175, 80, 'CNPJ / CPF', cnpj(ds.doc)); campo(175, 73, R, 80, 'DATA DA EMISSÃO', mdate(d.dhEmi));
  campo(L, 80, 99, 87, 'ENDEREÇO', endLinha(ds), 'l'); campo(99, 80, 142, 87, 'BAIRRO / DISTRITO', ds.bairro); campo(142, 80, 175, 87, 'CEP', cep(ds.cep)); campo(175, 80, R, 87, 'DATA DA SAÍDA/ENTRADA', mdate(d.dhSai));
  campo(L, 87, 99, 94, 'MUNICÍPIO', ds.mun, 'l'); campo(99, 87, 107, 94, 'UF', ds.uf); campo(107, 87, 141, 94, 'FONE / FAX', ds.fone); campo(141, 87, 175, 94, 'INSCRIÇÃO ESTADUAL', ds.ie); campo(175, 87, R, 94, 'HORA DA SAÍDA/ENTRADA', mtime(d.dhSai || d.dhEmi));
  if (d.entrega) {
    const en = d.entrega;
    titulo(d.entregaTitulo, 97.47);
    campo(L, 98, 128, 105, 'NOME / RAZÃO SOCIAL', en.nome || ds.nome, 'l'); campo(128, 98, 175, 105, 'CNPJ / CPF', cnpj(en.doc)); campo(175, 98, R, 105, 'INSCRIÇÃO ESTADUAL', en.ie);
    campo(L, 105, 108, 112, 'ENDEREÇO', endLinha(en), 'l'); campo(108, 105, 177, 112, 'BAIRRO / DISTRITO', en.bairro); campo(177, 105, R, 112, 'CEP', cep(en.cep));
    campo(L, 112, 168, 119, 'MUNICÍPIO', en.mun, 'l'); campo(168, 112, 176, 119, 'UF', en.uf); campo(176, 112, R, 119, 'FONE / FAX', en.fone);
  }
  let y = d.entrega ? 122.47 : 97.47;
  if (d.dups.length) {
    titulo('FATURA / DUPLICATA', y); const y0 = y + 0.53;
    d.dups.slice(0, 14).forEach((du, i) => {
      const col = i % 7, lin = Math.floor(i / 7), x0 = L + col * 29, yy = y0 + lin * 9;
      box(x0, yy, x0 + 28, yy + 8);
      TXT('Num.', x0 + 0.5, yy + 2.12, 'R', 6); TXT('Venc.', x0 + 0.5, yy + 5.06, 'R', 6); TXT('Valor', x0 + 0.5, yy + 7.5, 'R', 6);
      direita(du.n, x0 + 28, yy + 2.47, 'B', 7); direita(mdate(du.v), x0 + 28, yy + 5.23, 'B', 7); direita('R$ ' + num(du.valor, 2), x0 + 28, yy + 7.5, 'B', 7);
    });
    y = y0 + Math.ceil(Math.min(d.dups.length, 14) / 7) * 9 + 3.0 - 1.0 + 0.0;
  }
  // cálculo do imposto
  titulo('CÁLCULO DO IMPOSTO', y); const yc = y + 0.53;
  const calc = [
    [['BASE DE CÁLC. DO ICMS', d.tot.bc, 5], ['VALOR DO ICMS', d.tot.icms], ['BASE DE CÁLC. ICMS S.T.', d.tot.bcst, 5], ['VALOR DO ICMS SUBST.', d.tot.st, 5], ['V. IMP. IMPORTAÇÃO', d.tot.imp], ['V. ICMS UF REMET.', d.tot.remet], ['V. FCP UF DEST.', d.tot.fcp], ['VALOR DO PIS', d.tot.pis], ['V. TOTAL PRODUTOS', d.tot.prod]],
    [['VALOR DO FRETE', d.tot.frete], ['VALOR DO SEGURO', d.tot.seg], ['DESCONTO', d.tot.desc], ['OUTRAS DESPESAS', d.tot.outro], ['VALOR TOTAL IPI', d.tot.ipi], ['V. ICMS UF DEST.', d.tot.dest], ['V. TOT. TRIB.', d.tot.trib], ['VALOR DA COFINS', d.tot.cofins], ['V. TOTAL DA NOTA', d.tot.nf]]];
  calc.forEach((linha, li) => linha.forEach((c, i) => { const x0 = L + i * 22.889, x1 = L + (i + 1) * 22.889; campo(x0, yc + li * 7, x1, yc + li * 7 + 7, c[0], num(c[1] || 0, 2), 'r', 'B', 10, c[2] || 6); }));
  y = yc + 14 + 3.0;
  // transportador
  const t = d.transp; titulo('TRANSPORTADOR / VOLUMES TRANSPORTADOS', y); const yt = y + 0.53;
  campo(L, yt, 61.74, yt + 7, 'NOME / RAZÃO SOCIAL', t.nome, 'l', 'B', 6);
  campo(61.74, yt, 92.64, yt + 7, 'FRETE', MODFRETE[t.mod] || t.mod, 'c', 'B', 10);
  campo(92.64, yt, 123.54, yt + 7, 'CÓDIGO ANTT', t.antt); campo(123.54, yt, 154.44, yt + 7, 'PLACA DO VEÍCULO', t.placa); campo(154.44, yt, 162.44, yt + 7, 'UF', t.ufv); campo(162.44, yt, R, yt + 7, 'CNPJ / CPF', cnpj(t.doc));
  campo(L, yt + 7, 92.64, yt + 14, 'ENDEREÇO', t.end, 'l', 'B', 7); campo(92.64, yt + 7, 154.64, yt + 14, 'MUNICÍPIO', t.mun); campo(154.64, yt + 7, 162.64, yt + 14, 'UF', t.uf); campo(162.64, yt + 7, R, yt + 14, 'INSCRIÇÃO ESTADUAL', t.ie);
  campo(L, yt + 14, 23, yt + 21, 'QUANTIDADE', t.qvol); campo(23, yt + 14, 58, yt + 21, 'ESPÉCIE', t.esp); campo(58, yt + 14, 93, yt + 21, 'MARCA', t.marca); campo(93, yt + 14, 128, yt + 21, 'NUMERAÇÃO', t.nvol);
  campo(128, yt + 14, 169, yt + 21, 'PESO BRUTO', t.pesoB ? num(t.pesoB, 3) : '', 'r'); campo(169, yt + 14, R, yt + 21, 'PESO LÍQUIDO', t.pesoL ? num(t.pesoL, 3) : '', 'r');
  y = yt + 21 + 3.0;
  titulo('DADOS DOS PRODUTOS / SERVIÇOS', y);
  const topoTab = y + 0.53;
  const fim1 = NP === 1 ? BOT_FULL : BOT_CONT;
  cabecalhoTabela(topoTab, fim1);
  linhasItens(pg[0], topoTab + 5);
  if (NP === 1) adicionais();
  rodape();

  /* ---- páginas seguintes ---- */
  for (let p = 1; p < NP; p++) {
    S.addPage(); thin();
    const yb = blocoEmitente(2, p + 1, NP);
    titulo('DADOS DOS PRODUTOS / SERVIÇOS', yb + 4.47);
    const tt = yb + 5; const fim = p === NP - 1 ? BOT_FULL : BOT_CONT;
    cabecalhoTabela(tt, fim);
    linhasItens(pg[p], tt + 5);
    if (p === NP - 1) adicionais();
    rodape();
  }
  return { paginas: NP, y: 0 };
}


/* ============ Integração com a Entrada de NF ============ */
function nomeArquivoDanfe(d) {
  const limpa = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const forn = limpa(d.emit.nome).split(' ').slice(0, 3).join(' ');
  return ('DANFE NF ' + (d.nNF || 'sem numero') + (forn ? ' - ' + forn : '') + '.pdf').replace(/\s+/g, ' ');
}
function gerarDanfePdf(texto) {
  const d = lerNFe(texto);
  const pdf = new PdfOut(); desenharDanfe(d, pdf, { nLiteral: false });
  return { bytes: pdf.finish(), nome: nomeArquivoDanfe(d), dados: d };
}
async function baixarDanfePdf(textoXml) {
  // sem argumento: XML carregado na Entrada de NF; com argumento: texto do XML original guardado (Editor de NF)
  const texto = textoXml ? String(textoXml) : ((typeof xmlTextoAtual !== 'undefined' && xmlTextoAtual) ? String(xmlTextoAtual) : '');
  if (!texto) { toast('Carregue o XML da NF primeiro.'); return; }
  try { if (window.danfeFontesProntas) await window.danfeFontesProntas; } catch (e) {}
  let r;
  try { r = gerarDanfePdf(texto); } catch (err) { console.error(err); toast('✕ ' + ((err && err.message) || 'Não consegui montar o PDF desta NF.')); return; }
  const blob = new Blob([r.bytes], { type: 'application/pdf' });
  try {
    const arq = typeof File === 'function' ? new File([blob], r.nome, { type: 'application/pdf' }) : null;
    // folha de compartilhamento só em celular/tablet (iPhone: é o caminho para "Salvar em Arquivos"); no computador baixa direto
    const movel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') || (/Macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
    if (movel && arq && navigator.canShare && navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq], title: r.nome }); toast('✓ PDF pronto'); return; }
  } catch (err) { if (err && err.name === 'AbortError') return; /* qualquer outra falha: cai no download comum */ }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = r.nome; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('✓ PDF (DANFE) baixado!');
}
// Editor de NF: usa o XML original guardado junto da NF (xmlDados.xmlOriginal), sem passar pela conversão
function baixarDanfePdfDaNf(nfId) {
  const nf = (typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : []).find(n => n.id === nfId);
  const xml = nf && nf.xmlDados && nf.xmlDados.xmlOriginal;
  if (!xml) { toast('O XML original desta NF não está guardado (NF antiga ou arquivo muito grande).'); return; }
  return baixarDanfePdf(xml);
}
window.baixarDanfePdfDaNf = baixarDanfePdfDaNf;
window.baixarDanfePdf = baixarDanfePdf;
window.gerarDanfePdf = gerarDanfePdf;
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/49-danfe.js'] = '2.31.0';
