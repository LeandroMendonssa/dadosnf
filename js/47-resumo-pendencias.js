// 47-resumo-pendencias.js — Resumo de pendências de entrega dos fornecedores, por pedido (2.24.3)
// Parte do script do app. Arquivo comum, carregado pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Para um ou vários pedidos, monta o texto no formato usado na auditoria:
//   Quinta-feira, 05 de novembro de 2026.
//   RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES
//   PEDIDO 1748
//   NÃO ENTREGARAM:        (fornecedores que ainda não entregaram nada, um por linha, pelo apelido)
//   PENDÊNCIAS:            (fornecedores que entregaram, mas deixaram produto não faturado ainda não relatado)
//   FORNECEDOR - N.F. 123
//   PRODUTO, quantidade 10, não foi faturado.
// O texto fica num campo EDITÁVEL: PDF, Word e TXT saem do que estiver nele (observações digitadas à mão incluídas).
// Só lê o que o app já calcula. Nada é gravado, exceto a assinatura (Personalização > Assinatura dos relatórios).
// ===================================================================
let resumoPendPedidos = [], resumoPendTexto = '';
const NOTA_RESUMO_PADRAO = 'Desconsiderar pendências já resolvidas ou sinalizadas.';
const RS_AZUL = '#1f3a5f', RS_TEAL = '#1a8a8f';

function pedidosDoTextoResumo(txt) { return [...new Set(String(txt || '').split(/[^0-9]+/).filter(x => x.length >= 3))]; }
const maiusculoResumo = s => String(s || '').toUpperCase();
const itemLinhaResumo = (nome, qtd, resto) => `${maiusculoResumo(nome)}${qtd !== undefined && qtd !== null && qtd !== '' && qtd !== '—' ? ', quantidade ' + qtd : ''}, ${resto}`;
function dataExtensoResumo() { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) + '.'; }

// ---------- dados ----------
// { pedido, naoEntregaram:[nomes], pend:[{ nome, nfs:[], linhas:[] }] } ou null
// Regras: "não entregaram" = fornecedor sem nenhuma NF recebida (aguardando). "Pendências" = fornecedor que entregou mas tem produto
// NÃO FATURADO ainda não relatado (detectado pelo app ou em auditoria gerada e ainda não relatada). Quem entregou tudo, quem teve a
// entrega cancelada e quem só tem NF no ERP (sem auditoria de produto) não aparece.
function dadosResumoPendenciasPedido(pedido) {
    const d = dadosRelatorioCotacao(pedido); if (!d) return null;
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)) || {};
    const comp = compararFontesPedido(cot.pedido);
    const nota = (typeof listaAnotacoes !== 'undefined' ? listaAnotacoes : []).find(a => String(a.pedido) === String(cot.pedido));
    const r = { pedido: String(pedido), naoEntregaram: [], pend: [] };
    d.fornecedores.forEach(f => {
        const nome = maiusculoResumo(f.nome), ch = normalizarCnpj(f.cnpj);
        if (f.status.chave === 'cancelada') return;
        const linhas = [], nfs = [], visto = new Set();
        const add = t => { const k = maiusculoResumo(t).replace(/\s+/g, ' ').trim(); if (k && !visto.has(k)) { visto.add(k); linhas.push(t); } };
        // (a) detectado pelo app e ainda sem auditoria
        comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === ch && x.estado === 'detectada' && x.soNaoChegou).forEach(x => {
            const dv = (x.divergencias || []).find(v => v.tipo === 'nao_faturado') || {};
            const it = (cot.itens || []).find(i => i.codProduto === x.codProduto) || {};
            const qtd = dv.quantidadeCotada !== undefined && dv.quantidadeCotada !== '' ? dv.quantidadeCotada : it.quantidade;
            add(itemLinhaResumo(x.nome || it.nomeOficial || it.descricao || x.codProduto, qtd, 'não foi faturado.'));
        });
        // (b) auditoria já gerada de produto não faturado, ainda não relatada (relatada/resolvida = "já sinalizada": não entra)
        ((nota && nota.ocorrencias) || []).filter(oc => normalizarCnpj(oc.fornecedorCnpj) === ch).forEach(oc => (oc.divergencias || []).forEach(dv => {
            if (dv.tipo !== 'nao_faturado' || (dv.status || 'pendente') !== 'pendente' || dv.relatado !== false) return;
            let ls = []; try { ls = linhasDeMateriais(dv); } catch (e) { /* tipo antigo */ }
            ls.forEach(add); if (ls.length && oc.notaFiscal && !nfs.includes(String(oc.notaFiscal))) nfs.push(String(oc.notaFiscal));
        }));
        if (linhas.length) r.pend.push({ nome, nfs, linhas });
        else if (f.status.chave === 'pendente' && !/ERP/i.test(f.status.detalhe || '')) r.naoEntregaram.push(nome);
    });
    r.naoEntregaram.sort((a, b) => a.localeCompare(b)); r.pend.sort((a, b) => a.nome.localeCompare(b.nome));
    return r;
}

function textoResumoPendencias(pedidos) {
    const L = [dataExtensoResumo(), 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', ''], naoAchados = [];
    pedidos.forEach(p => {
        let r; try { r = dadosResumoPendenciasPedido(p); } catch (e) { console.error('Resumo de pendências', p, e); r = null; }
        if (!r) { naoAchados.push(p); return; }
        L.push(`PEDIDO ${r.pedido}`, '');
        if (r.naoEntregaram.length) { L.push('NÃO ENTREGARAM:'); r.naoEntregaram.forEach(n => L.push(n)); L.push(''); }
        if (r.pend.length) {
            L.push('PENDÊNCIAS:', '');
            r.pend.forEach(x => { L.push(x.nome + (x.nfs.length ? ' - N.F. ' + x.nfs.join(', ') : ':')); x.linhas.forEach(l => L.push(l)); L.push(''); });
        }
        if (!r.naoEntregaram.length && !r.pend.length) L.push('Sem pendências de entrega.', '');
        L.push('');
    });
    if (naoAchados.length) L.push(`Pedido(s) não encontrado(s) em Cotações: ${naoAchados.join(', ')}.`, '');
    L.push(NOTA_RESUMO_PADRAO);
    return L.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}

// ---------- o texto (editável) vira blocos para o PDF e o Word ----------
// { data, titulo, previa:[texto], pedidos:[{ num, toks:[{k:'rotulo'|'nome'|'forn'|'item'|'texto', t}] }], nota }
function blocosResumoPendencias(texto) {
    const b = { data: '', titulo: '', previa: [], pedidos: [], nota: '' };
    let atual = null, modo = '';
    String(texto || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
        if (!b.data && !atual && !b.titulo && /^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/i.test(l)) { b.data = l; return; }
        if (!b.titulo && !atual && /^RESUMO DE /i.test(l)) { b.titulo = l; return; }
        if (/^Desconsiderar/i.test(l)) { b.nota = l; return; }
        const mp = l.match(/^PEDIDO\s+(\S+)/i);
        if (mp) { atual = { num: mp[1], toks: [] }; b.pedidos.push(atual); modo = ''; return; }
        if (/^N[ÃA]O ENTREGARAM:?$/i.test(l)) { if (atual) atual.toks.push({ k: 'rotulo', t: 'Não entregaram:' }); modo = 'nomes'; return; }
        if (/^PEND[ÊE]NCIAS:?$/i.test(l)) { if (atual) atual.toks.push({ k: 'rotulo', t: 'Pendências:' }); modo = 'pend'; return; }
        if (!atual) { b.previa.push(l); return; }
        if (modo === 'nomes') atual.toks.push({ k: (l === l.toUpperCase() && l.length < 40) ? 'nome' : 'texto', t: l });
        else if (modo === 'pend') atual.toks.push({ k: ((/:$/.test(l) || /\sN\.?\s?F\./i.test(l)) && l === l.toUpperCase() && l.length < 90) ? 'forn' : 'item', t: l });
        else atual.toks.push({ k: 'texto', t: l });
    });
    return b;
}

// ---------- assinatura (nome do usuário logado + dados de Personalização > Assinatura dos relatórios) ----------
function assinaturaRelatorio() {
    const a = (appConfig.personalizacao && appConfig.personalizacao.assinatura) || {};
    let nome = (a.nome || '').trim();
    if (!nome) { try { const u = auth.currentUser; nome = (u && (u.displayName || (u.email || '').split('@')[0])) || ''; } catch (e) { /* sem usuário */ } }
    return { nome, cargo: (a.cargo || '').trim(), email: (a.email || '').trim(), telefone: (a.telefone || '').trim(), site: (a.site || '').trim(), endereco: (a.endereco || '').trim() };
}
const ASSINATURA_CAMPOS = ['nome', 'cargo', 'email', 'telefone', 'site', 'endereco'];
function assinaturaPreencherCampos() {
    const a = (appConfig.personalizacao && appConfig.personalizacao.assinatura) || {}, pad = assinaturaRelatorio();
    ASSINATURA_CAMPOS.forEach(c => { const el = document.getElementById('assin-' + c); if (el) { el.value = a[c] || ''; if (c === 'nome') el.placeholder = pad.nome || 'Nome do usuário logado'; } });
}
let assinaturaTimer = null;
function assinaturaSalvarCampos() {
    clearTimeout(assinaturaTimer);
    assinaturaTimer = setTimeout(() => {
        const v = {}; ASSINATURA_CAMPOS.forEach(c => { const el = document.getElementById('assin-' + c); v[c] = el ? el.value.trim() : ''; });
        appConfig.personalizacao = { ...(appConfig.personalizacao || {}), assinatura: v };
        try { salvarPersonalizacao(); } catch (e) { console.error('Assinatura:', e); }
    }, 600);
}
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-screen="screen-pz-assinatura"]'); if (a) setTimeout(assinaturaPreencherCampos, 50); });

// ---------- Word (.doc em HTML) ----------
function htmlResumoPendencias(texto) {
    const b = blocosResumoPendencias(texto), e = escRel, logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : null, s = assinaturaRelatorio();
    const linhasAss = [['✉', s.email], ['☎', s.telefone], ['◎', s.site], ['⌖', s.endereco]].filter(x => x[1]);
    const assHtml = `<table align="center" style="border-collapse:collapse"><tr>${logo ? `<td style="padding-right:14pt"><img src="${logo}" width="82" height="62"></td><td width="1" style="border-left:1pt solid #bbbbbb"></td>` : ''}<td style="padding-left:${logo ? 14 : 0}pt;font-family:Arial,sans-serif">
${s.nome ? `<p style="margin:0;font-size:11pt;font-weight:bold;color:${RS_AZUL}">${e(s.nome)}</p>` : ''}${s.cargo ? `<p style="margin:0 0 4pt;font-size:8.5pt;color:${RS_TEAL}">${e(s.cargo)}</p>` : ''}
${linhasAss.map(([i, t]) => `<p style="margin:1.5pt 0;font-size:7.6pt;color:#333333"><span style="color:${RS_TEAL}">${i}</span>&nbsp; ${e(t)}</p>`).join('')}</td></tr></table>
<p style="margin:10pt 0 0;text-align:right;font-size:8.5pt;font-style:italic;color:#444444">${e(b.nota || '')}</p>`;
    let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Resumo de pendências</title>
<style>@page WordSection1{size:21cm 29.7cm;margin:1.3cm 1.6cm 4.6cm 1.6cm;mso-footer:f1}div.WordSection1{page:WordSection1}
body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111111}p{margin:0}table{border-collapse:collapse}td{vertical-align:top}
.lb{font-size:9.5pt;font-weight:bold;text-transform:uppercase;margin:0 0 6pt}</style></head><body><div class="WordSection1">
<p style="text-align:right;font-size:9pt;font-style:italic;color:#444444">${e(b.data)}</p>
<p style="font-size:21pt;font-weight:bold;color:${RS_AZUL};margin:16pt 0 20pt;line-height:1.15">${e(b.titulo || 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES')}</p>
${b.previa.map(t => `<p style="margin-bottom:8pt">${e(t)}</p>`).join('')}`;
    b.pedidos.forEach(p => {
        h += `<table width="100%" style="border-top:3pt solid ${RS_AZUL};margin-top:4pt"><tr><td width="92" style="padding:14pt 0 14pt"><p style="font-size:8.5pt;font-weight:bold;color:#333333">PEDIDO</p><p style="font-size:27pt;font-weight:bold;color:${RS_AZUL};line-height:1">${e(p.num)}</p></td>
<td style="border-left:1pt solid #bbbbbb;padding:14pt 0 14pt 16pt">`;
        let nomes = [];
        const fechaNomes = () => { if (!nomes.length) return; h += '<table width="100%" style="margin-bottom:4pt">'; for (let i = 0; i < nomes.length; i += 2) h += `<tr><td width="50%" style="padding:2pt 0">${e(nomes[i])}</td><td style="padding:2pt 0">${nomes[i + 1] ? e(nomes[i + 1]) : ''}</td></tr>`; h += '</table>'; nomes = []; };
        let primeiro = true;
        p.toks.forEach((t, i) => {
            if (t.k !== 'nome') fechaNomes();
            if (t.k === 'rotulo') { h += `<p class="lb" style="${primeiro ? '' : 'margin-top:14pt'}">${e(t.t)}</p>`; }
            else if (t.k === 'nome') nomes.push(t.t);
            else if (t.k === 'forn') h += `<p style="font-size:11pt;font-weight:bold;margin-top:2pt">${e(t.t)}</p>`;
            else if (t.k === 'item') h += `<p style="font-style:italic;line-height:1.35;margin:2pt 0 ${(p.toks[i + 1] && p.toks[i + 1].k === 'item') ? 2 : 11}pt">${e(t.t)}</p>`;
            else h += `<p style="margin-bottom:6pt">${e(t.t)}</p>`;
            primeiro = false;
        });
        fechaNomes(); h += '</td></tr></table>';
    });
    h += `<table width="100%" style="border-top:1pt solid ${RS_AZUL}"><tr><td></td></tr></table></div>
<div style="mso-element:footer" id="f1">${assHtml}</div></body></html>`;
    return h;
}

// ---------- PDF (jsPDF) ----------
function gerarPdfResumoPendencias(texto) {
    const b = blocosResumoPendencias(texto), { jsPDF } = jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 46, LARG = W - 2 * M, SIDE = 92, GAP = 18, XC = M + SIDE + GAP, WC = LARG - SIDE - GAP, LIM = H - 146;
    const s = assinaturaRelatorio(), logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : null;
    const fill = h => { const c = rgbRelCot(h); doc.setFillColor(c[0], c[1], c[2]); }, draw = h => { const c = rgbRelCot(h); doc.setDrawColor(c[0], c[1], c[2]); }, ink = h => { const c = rgbRelCot(h); doc.setTextColor(c[0], c[1], c[2]); };
    const fonte = (tam, est) => { doc.setFont('helvetica', est || 'normal'); doc.setFontSize(tam); };
    const quebra = (t, larg, tam, est) => { fonte(tam, est); return doc.splitTextToSize(String(t), Math.max(30, larg)); };
    let y = 36;
    // ---- topo
    if (b.data) { fonte(9, 'italic'); ink('#444444'); doc.text(b.data, W - M, y + 8, { align: 'right' }); }
    y += 22;
    const tit = quebra(b.titulo || 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', LARG, 21, 'bold');
    fonte(21, 'bold'); ink(RS_AZUL); tit.forEach((l, i) => doc.text(l, M, y + 20 + i * 24)); y += tit.length * 24 + 24;
    b.previa.forEach(t => { const ls = quebra(t, LARG, 10.5); fonte(10.5); ink('#111111'); ls.forEach((l, i) => doc.text(l, M, y + 10 + i * 14.5)); y += ls.length * 14.5 + 8; });
    // ---- pedidos
    let y0 = 0, pagIni = 0;
    const barraVertical = (ini, fim) => { if (fim > ini) { draw('#bbbbbb'); doc.setLineWidth(1); doc.line(M + SIDE, ini, M + SIDE, fim); } };
    const garantir = (alt) => { if (y + alt > LIM) { barraVertical(y0, y); doc.addPage(); y = 40; y0 = y; return true; } return false; };
    b.pedidos.forEach(p => {
        if (y + 90 > LIM) { doc.addPage(); y = 40; }
        fill(RS_AZUL); doc.rect(M, y, LARG, 3, 'F'); y += 3 + 16; y0 = y - 16;
        fonte(8.5, 'bold'); ink('#333333'); doc.text('PEDIDO', M, y + 8);
        fonte(27, 'bold'); ink(RS_AZUL); doc.text(String(p.num), M, y + 36);
        const toks = p.toks; let i = 0, primeiro = true;
        while (i < toks.length) {
            const t = toks[i];
            if (t.k === 'rotulo') {
                if (!primeiro) y += 14; garantir(30); fonte(9.5, 'bold'); ink('#111111'); doc.text(t.t.toUpperCase(), XC, y + 9); y += 18; i++;
            } else if (t.k === 'nome') {
                const grupo = []; while (i < toks.length && toks[i].k === 'nome') grupo.push(toks[i++].t);
                for (let g = 0; g < grupo.length; g += 2) {
                    garantir(18); fonte(10.5); ink('#111111'); doc.text(grupo[g], XC, y + 10); if (grupo[g + 1]) doc.text(grupo[g + 1], XC + WC / 2, y + 10); y += 17;
                }
            } else if (t.k === 'forn') {
                const ls = quebra(t.t, WC, 11, 'bold'); garantir(ls.length * 14 + 18); fonte(11, 'bold'); ink('#111111'); ls.forEach((l, k) => doc.text(l, XC, y + 11 + k * 14)); y += ls.length * 14 + 3; i++;
            } else if (t.k === 'item') {
                const ls = quebra(t.t, WC, 10.5, 'italic'); garantir(ls.length * 14.5 + 4); fonte(10.5, 'italic'); ink('#222222'); ls.forEach((l, k) => doc.text(l, XC, y + 10.5 + k * 14.5));
                y += ls.length * 14.5 + ((toks[i + 1] && toks[i + 1].k === 'item') ? 3 : 13); i++;
            } else {
                const ls = quebra(t.t, WC, 10.5); garantir(ls.length * 14.5 + 6); fonte(10.5); ink('#111111'); ls.forEach((l, k) => doc.text(l, XC, y + 10.5 + k * 14.5)); y += ls.length * 14.5 + 6; i++;
            }
            primeiro = false;
        }
        y += 6; barraVertical(y0, y); y += 10;
    });
    if (b.pedidos.length) { draw(RS_AZUL); doc.setLineWidth(1); doc.line(M, y, W - M, y); }
    // ---- assinatura + aviso no fim de TODAS as páginas
    const linhasAss = [['email', s.email], ['fone', s.telefone], ['site', s.site], ['pin', s.endereco]].filter(x => x[1]);
    const ico = (tipo, x, yy) => {
        draw(RS_TEAL); doc.setLineWidth(0.8);
        if (tipo === 'email') { doc.rect(x, yy + 1.5, 8, 5.5); doc.line(x, yy + 1.5, x + 4, yy + 4.7); doc.line(x + 4, yy + 4.7, x + 8, yy + 1.5); }
        else if (tipo === 'fone') { doc.roundedRect(x + 2, yy, 4.2, 8, 0.8, 0.8, 'S'); doc.line(x + 3.2, yy + 6.7, x + 5, yy + 6.7); }
        else if (tipo === 'site') { doc.circle(x + 4, yy + 4, 4, 'S'); doc.ellipse(x + 4, yy + 4, 1.7, 4, 'S'); doc.line(x, yy + 4, x + 8, yy + 4); }
        else { doc.circle(x + 4, yy + 3.2, 3.2, 'S'); doc.line(x + 1, yy + 5.2, x + 4, yy + 8.8); doc.line(x + 7, yy + 5.2, x + 4, yy + 8.8); doc.circle(x + 4, yy + 3.2, 1, 'S'); }
    };
    fonte(7.6); let largTxt = 0; linhasAss.forEach(([, t]) => { largTxt = Math.max(largTxt, doc.getTextWidth(t) + 14); });
    fonte(11, 'bold'); largTxt = Math.max(largTxt, doc.getTextWidth(s.nome || '')); fonte(8.5); largTxt = Math.max(largTxt, doc.getTextWidth(s.cargo || ''));
    const altTxt = (s.nome ? 14 : 0) + (s.cargo ? 15 : 0) + linhasAss.length * 11.5, altBloco = Math.max(logo ? 62 : 0, altTxt);
    const largTot = (logo ? 82 + 32 : 0) + largTxt, n = doc.getNumberOfPages();
    for (let pg = 1; pg <= n; pg++) {
        doc.setPage(pg);
        const yb = H - 50, yt = yb - altBloco; let x = M + (LARG - largTot) / 2;
        if (logo) { try { doc.addImage(logo, 'PNG', x, yt + (altBloco - 62) / 2, 82, 62); } catch (err) { /* logo inválida: segue sem */ } x += 82 + 16; draw('#bbbbbb'); doc.setLineWidth(0.8); doc.line(x, yt + 1, x, yb - 1); x += 16; }
        let yy = yt + (altBloco - altTxt) / 2;
        if (s.nome) { fonte(11, 'bold'); ink(RS_AZUL); doc.text(s.nome, x, yy + 10); yy += 14; }
        if (s.cargo) { fonte(8.5); ink(RS_TEAL); doc.text(s.cargo, x, yy + 7); yy += 15; }
        linhasAss.forEach(([tp, t]) => { ico(tp, x, yy); fonte(7.6); ink('#333333'); doc.text(t, x + 14, yy + 6.8); yy += 11.5; });
        if (b.nota) { fonte(8.5, 'italic'); ink('#444444'); doc.text(b.nota, W - M, H - 24, { align: 'right' }); }
    }
    return doc;
}

// ---------- tela (janela) de uso ----------
function abrirResumoPendencias(pedidosIniciais) {
    try { if (typeof assinarDados === 'function') assinarDados('fornecedoresSpData'); } catch (e) { }   // apelidos dos fornecedores
    const lista = Array.isArray(pedidosIniciais) ? pedidosIniciais : (pedidosIniciais ? [pedidosIniciais] : []);
    const campo = document.getElementById('resumo-pend-pedidos'); if (campo && lista.length) campo.value = lista.join(', ');
    const m = document.getElementById('resumo-pend-modal'); if (m) m.classList.add('active');
    gerarResumoPendencias(); setTimeout(() => { const m2 = document.getElementById('resumo-pend-modal'), a = document.getElementById('resumo-pend-texto'); if (m2 && m2.classList.contains('active') && a && a.dataset.editado !== '1') gerarResumoPendencias(); }, 1500);   // refaz quando o cadastro de fornecedores terminar de carregar (se você ainda não editou o texto)
}
function abrirResumoPendenciasSelecionadas() {
    const sel = typeof cotacoesSelecionadas !== 'undefined' ? [...cotacoesSelecionadas] : [];
    if (!sel.length) return toast('Selecione ao menos uma cotação.');
    abrirResumoPendencias(sel);
}
// monta o texto a partir dos pedidos digitados (e descarta edições anteriores)
function gerarResumoPendencias() {
    const campo = document.getElementById('resumo-pend-pedidos'), area = document.getElementById('resumo-pend-texto'); if (!campo || !area) return;
    resumoPendPedidos = pedidosDoTextoResumo(campo.value); area.dataset.editado = '';
    area.value = resumoPendPedidos.length ? textoResumoPendencias(resumoPendPedidos) : '';
}
function textoAtualResumo() { const a = document.getElementById('resumo-pend-texto'); return a ? a.value : ''; }
async function copiarResumoPendencias() {
    const t = textoAtualResumo(); if (!t.trim()) return toast('Informe os números dos pedidos.');
    try { await navigator.clipboard.writeText(t); toast('✓ Resumo copiado.'); }
    catch (e) { const a = document.getElementById('resumo-pend-texto'); if (a) { a.focus(); a.select(); } toast('Selecione e copie o texto.'); }
}
async function baixarResumoPendencias(formato) {
    const texto = textoAtualResumo(); if (!texto.trim()) return toast('Informe os números dos pedidos.');
    const base = 'Resumo-pendencias-' + (resumoPendPedidos.slice(0, 4).join('-') || 'pedidos');
    try {
        let ok = false;
        if (formato === 'doc') ok = await entregarArquivoRelCot(base + '.doc', new Blob(['﻿', htmlResumoPendencias(texto)], { type: 'application/msword' }));
        else if (formato === 'pdf') {
            if (typeof jspdf === 'undefined') return toast('✕ A biblioteca de PDF ainda não carregou — aguarde um instante e tente de novo.');
            ok = await entregarArquivoRelCot(base + '.pdf', gerarPdfResumoPendencias(texto).output('blob'));
        } else ok = await entregarArquivoRelCot(base + '.txt', new Blob([texto], { type: 'text/plain;charset=utf-8' }));
        if (ok) toast('✓ Arquivo gerado.');
    } catch (err) { console.error('Resumo de pendências:', err); toast('✕ Erro ao gerar o arquivo.'); }
}
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/47-resumo-pendencias.js'] = '2.24.3';
