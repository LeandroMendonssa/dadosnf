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
// 2.37.0: os pedidos entram SOZINHOS (mesmo critério e janela da tela inicial: fornecedor que ainda não entregou ou que entregou e deixou pendência).
// Cada linha leva o seu tipo: 'nf' (produto não faturado), 'div' (outra divergência de auditoria) e 'obs' (observação da ocorrência).
// Só entram ocorrências de auditoria ainda "geradas, não relatadas" (resolvida/relatada = já sinalizada). Anotações de texto livre NÃO são usadas.
// { pedido, nao:[nomes], forn:[{ nome, linhas:[{k,t,nf}] }] } ou null
const RP_TIPOS = ['nao', 'nf', 'div', 'obs'], RP_PADRAO = { nao: true, nf: true, div: false, obs: false };
function dadosResumoPendenciasPedido(pedido) {
    const d = dadosRelatorioCotacao(pedido); if (!d) return null;
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)) || {};
    const comp = compararFontesPedido(cot.pedido);
    const nota = (typeof listaAnotacoes !== 'undefined' ? listaAnotacoes : []).find(a => String(a.pedido) === String(cot.pedido) && Array.isArray(a.ocorrencias));
    const r = { pedido: String(pedido), nao: [], forn: [] };
    d.fornecedores.forEach(f => {
        const nome = maiusculoResumo((() => { try { return nomeExibicaoFornecedor(f.nome, f.cnpj) || f.nome; } catch (e) { return f.nome; } })()), ch = normalizarCnpj(f.cnpj);
        if (f.status.chave === 'cancelada') return;
        const linhas = [], visto = new Set();
        const add = (k, t, nf) => { const c = maiusculoResumo(t).replace(/\s+/g, ' ').trim(); if (c && !visto.has(c)) { visto.add(c); linhas.push({ k, t, nf: nf ? String(nf) : '' }); } };
        // (a) detectado pelo app e ainda sem auditoria
        comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === ch && x.estado === 'detectada' && x.soNaoChegou).forEach(x => {
            const dv = (x.divergencias || []).find(v => v.tipo === 'nao_faturado') || {};
            const it = (cot.itens || []).find(i => i.codProduto === x.codProduto) || {};
            const qtd = dv.quantidadeCotada !== undefined && dv.quantidadeCotada !== '' ? dv.quantidadeCotada : it.quantidade;
            add('nf', itemLinhaResumo(x.nome || it.nomeOficial || it.descricao || x.codProduto, qtd, 'não foi faturado.'));
        });
        // (b) ocorrências de auditoria geradas e ainda não relatadas (é aqui que está o rastro correto: NF, divergência e observação)
        ((nota && nota.ocorrencias) || []).filter(oc => normalizarCnpj(oc.fornecedorCnpj) === ch || (!oc.fornecedorCnpj && oc.fornecedor && maiusculoResumo(oc.fornecedor) === nome)).forEach(oc => {
            let teve = false;
            (oc.divergencias || []).forEach(dv => {
                if ((dv.status || 'pendente') !== 'pendente' || dv.relatado !== false) return;
                let ls = []; try { ls = linhasDeMateriais(dv); } catch (e) { /* tipo antigo */ }
                ls.forEach(t => add(dv.tipo === 'nao_faturado' ? 'nf' : 'div', t, oc.notaFiscal)); if (ls.length) teve = true;
            });
            if (teve && String(oc.observacaoGeral || '').trim()) add('obs', String(oc.observacaoGeral).trim(), oc.notaFiscal);
        });
        if (linhas.length) r.forn.push({ nome, linhas });
        else if (f.status.chave === 'pendente' && !/ERP/i.test(f.status.detalhe || '')) r.nao.push(nome);
    });
    r.nao.sort((a, b) => a.localeCompare(b)); r.forn.sort((a, b) => a.nome.localeCompare(b.nome));
    return r;
}
// todos os pedidos recentes (e os extras digitados) já calculados; as caixinhas só filtram isto depois
function dadosResumoTodos(extras) {
    const lim = Date.now() - (typeof INI_JANELA_DIAS === 'number' ? INI_JANELA_DIAS : 60) * 86400000, out = [], ja = new Set();
    const tenta = (p, forcar) => {
        if (ja.has(String(p))) return; ja.add(String(p));
        let r; try { r = dadosResumoPendenciasPedido(p); } catch (e) { console.error('Resumo de pendências', p, e); r = null; }
        out.push({ pedido: String(p), forcado: !!forcar, achou: !!r, r: r || { pedido: String(p), nao: [], forn: [] } });
    };
    comMemoComparacao(() => {
        (listaCotacoes || []).forEach(c => { const ref = Date.parse(c.dataPedido || c.atualizadoEm || '') || 0; if (ref && ref < lim) return; tenta(c.pedido, false); });
        (extras || []).forEach(p => tenta(p, true));
    });
    return out.sort((a, b) => (Number(a.pedido) || 0) - (Number(b.pedido) || 0));
}
function filtrarResumoPedido(r, op) {
    const nao = op.nao ? r.nao : [];
    const forn = r.forn.map(f => ({ nome: f.nome, linhas: f.linhas.filter(l => op[l.k]) })).filter(f => f.linhas.length);
    return { pedido: r.pedido, nao, forn };
}
function contagemResumo(todos) {
    const c = { nao: 0, nf: 0, div: 0, obs: 0 };
    todos.forEach(x => { c.nao += x.r.nao.length; x.r.forn.forEach(f => f.linhas.forEach(l => c[l.k]++)); });
    return c;
}

function textoResumoPendencias(todos, op) {
    const L = [dataExtensoResumo(), 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', ''], naoAchados = [];
    let algum = false;
    todos.forEach(x => {
        if (x.forcado && !x.achou) { naoAchados.push(x.pedido); return; }
        const r = filtrarResumoPedido(x.r, op);
        if (!r.nao.length && !r.forn.length && !x.forcado) return;
        algum = true;
        L.push(`PEDIDO ${r.pedido}`, '');
        if (r.nao.length) { L.push('NÃO ENTREGARAM:'); r.nao.forEach(n => L.push(n)); L.push(''); }
        if (r.forn.length) {
            L.push('PENDÊNCIAS:', '');
            r.forn.forEach(f => {
                const nfs = [...new Set(f.linhas.map(l => l.nf).filter(Boolean))];
                L.push(f.nome + (nfs.length ? ' - N.F. ' + nfs.join(', ') : ':')); f.linhas.forEach(l => L.push(l.t)); L.push('');
            });
        }
        if (!r.nao.length && !r.forn.length) L.push('Sem pendências de entrega.', '');
        L.push('');
    });
    if (!algum) L.push('Nenhum pedido com pendência de entrega no momento.', '');
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
    }, 400);
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
body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111111}p{margin:0}</style></head><body><div class="WordSection1">
<p style="text-align:right;font-size:9.5pt;font-style:italic">${e(b.data)}</p>
<p style="font-size:16pt;font-weight:bold;text-decoration:underline;text-align:center;margin:14pt 30pt 18pt;line-height:1.25">${e(b.titulo || 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES')}</p>
${b.previa.map(t => `<p style="margin-bottom:8pt">${e(t)}</p>`).join('')}`;
    b.pedidos.forEach(p => {
        h += `<p style="font-weight:bold;margin:12pt 0 6pt">PEDIDO ${e(p.num)}</p>`;
        p.toks.forEach((t, i) => {
            if (t.k === 'rotulo') { if (!/^N[ãa]o entregaram/i.test(t.t)) h += `<p style="font-weight:bold;margin:10pt 0 6pt">${e(t.t.toUpperCase())}</p>`; }
            else if (t.k === 'nome') h += `<p style="margin:0 0 ${(p.toks[i + 1] && p.toks[i + 1].k === 'nome') ? 0 : 8}pt">${e(t.t)}</p>`;
            else if (t.k === 'forn') h += `<p style="font-weight:bold;margin-top:6pt">${e(t.t)}</p>`;
            else if (t.k === 'item') h += `<p style="font-style:italic;line-height:1.3;margin:0 0 ${(p.toks[i + 1] && p.toks[i + 1].k === 'item') ? 0 : 8}pt">${e(t.t)}</p>`;
            else h += `<p style="margin-bottom:6pt">${e(t.t)}</p>`;
        });
        h += '<p style="border-bottom:1pt solid #000000;margin:6pt 0 0;font-size:2pt">&nbsp;</p>';
    });
    h += `</div>
<div style="mso-element:footer" id="f1">${assHtml}</div></body></html>`;
    return h;
}

// ---------- PDF (jsPDF) ----------
function gerarPdfResumoPendencias(texto) {
    const b = blocosResumoPendencias(texto), { jsPDF } = jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 46, LARG = W - 2 * M, SIDE = 92, GAP = 18, XC = M + SIDE + GAP, WC = LARG - SIDE - GAP, LIM = H - 150;
    const s = assinaturaRelatorio(), logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : null;
    const fill = h => { const c = rgbRelCot(h); doc.setFillColor(c[0], c[1], c[2]); }, draw = h => { const c = rgbRelCot(h); doc.setDrawColor(c[0], c[1], c[2]); }, ink = h => { const c = rgbRelCot(h); doc.setTextColor(c[0], c[1], c[2]); };
    const fonte = (tam, est) => { doc.setFont('helvetica', est || 'normal'); doc.setFontSize(tam); };
    const quebra = (t, larg, tam, est) => { fonte(tam, est); return doc.splitTextToSize(String(t), Math.max(30, larg)); };
    let y = 36;
    // ---- topo (layout do relatório antigo: sem tabela, sem cores)
    if (b.data) { fonte(9.5, 'italic'); ink('#111111'); doc.text(b.data, W - M, y + 8, { align: 'right' }); }
    y += 30;
    const tit = quebra(b.titulo || 'RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', LARG * 0.8, 16, 'bold');
    fonte(16, 'bold'); ink('#000000'); draw('#000000'); doc.setLineWidth(1);
    tit.forEach((l, i) => { const yy = y + 16 + i * 20, w = doc.getTextWidth(l); doc.text(l, W / 2, yy, { align: 'center' }); doc.line(W / 2 - w / 2, yy + 2.5, W / 2 + w / 2, yy + 2.5); });
    y += tit.length * 20 + 22;
    b.previa.forEach(t => { const ls = quebra(t, LARG, 10.5); fonte(10.5); ink('#111111'); ls.forEach((l, i) => doc.text(l, M, y + 10 + i * 14.5)); y += ls.length * 14.5 + 8; });
    // ---- pedidos
    const garantir = alt => { if (y + alt > LIM) { doc.addPage(); y = 40; } };
    b.pedidos.forEach(p => {
        garantir(60);
        fonte(10.5, 'bold'); ink('#000000'); doc.text('PEDIDO ' + p.num, M, y + 10); y += 22;
        const toks = p.toks; let i = 0, primeiro = true;
        while (i < toks.length) {
            const t = toks[i];
            if (t.k === 'rotulo') {
                if (/^N[ãa]o entregaram/i.test(t.t)) { i++; continue; }   // a lista simples de quem não entregou fica sem rótulo, como no relatório antigo
                garantir(34); fonte(10.5, 'bold'); ink('#000000'); doc.text(t.t.toUpperCase(), M, y + 10); y += 22; i++;
            } else if (t.k === 'nome') {
                garantir(16); fonte(10.5); ink('#111111'); doc.text(t.t, M, y + 10); y += 14.5; i++;
                if (!(toks[i] && toks[i].k === 'nome')) y += 8;
            } else if (t.k === 'forn') {
                const ls = quebra(t.t, LARG, 10.5, 'bold'); garantir(ls.length * 14.5 + 18); fonte(10.5, 'bold'); ink('#000000'); ls.forEach((l, k) => doc.text(l, M, y + 10 + k * 14.5)); y += ls.length * 14.5; i++;
            } else if (t.k === 'item') {
                const ls = quebra(t.t, LARG, 10.5, 'italic'); garantir(ls.length * 14.5 + 4); fonte(10.5, 'italic'); ink('#111111'); ls.forEach((l, k) => doc.text(l, M, y + 10 + k * 14.5));
                y += ls.length * 14.5 + ((toks[i + 1] && toks[i + 1].k === 'item') ? 0 : 12); i++;
            } else {
                const ls = quebra(t.t, LARG, 10.5); garantir(ls.length * 14.5 + 6); fonte(10.5); ink('#111111'); ls.forEach((l, k) => doc.text(l, M, y + 10 + k * 14.5)); y += ls.length * 14.5 + 6; i++;
            }
            primeiro = false;
        }
        y += 2; draw('#000000'); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 16;
    });
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
const RP_CHAVE = 'resumoPendOpcoesV1';
let resumoPendTodos = [];
function rpOpcoes() { const o = {}; RP_TIPOS.forEach(k => { const el = document.getElementById('rp-' + k); o[k] = el ? el.checked : RP_PADRAO[k]; }); return o; }
function rpRestaurarOpcoes() {
    let sv = {}; try { sv = JSON.parse(localStorage.getItem(RP_CHAVE) || '{}') || {}; } catch (e) { sv = {}; }
    RP_TIPOS.forEach(k => { const el = document.getElementById('rp-' + k); if (el) el.checked = (k in sv) ? !!sv[k] : RP_PADRAO[k]; });
}
function rpGuardarOpcoes() { try { localStorage.setItem(RP_CHAVE, JSON.stringify(rpOpcoes())); } catch (e) { /* sem armazenamento */ } }
function abrirResumoPendencias(pedidosIniciais) {
    try { if (typeof assinarDados === 'function') assinarDados('fornecedoresSpData'); } catch (e) { }   // apelidos dos fornecedores
    const lista = Array.isArray(pedidosIniciais) ? pedidosIniciais : (pedidosIniciais ? [pedidosIniciais] : []);
    const campo = document.getElementById('resumo-pend-pedidos'); if (campo) campo.value = lista.join(', ');
    rpRestaurarOpcoes();
    const ed = document.getElementById('resumo-pend-texto'); if (ed) { ed.style.display = 'none'; ed.dataset.editado = ''; }
    const m = document.getElementById('resumo-pend-modal'); if (m) m.classList.add('active');
    gerarResumoPendencias(true);
    setTimeout(() => { const m2 = document.getElementById('resumo-pend-modal'), a = document.getElementById('resumo-pend-texto'); if (m2 && m2.classList.contains('active') && a && a.dataset.editado !== '1') gerarResumoPendencias(true); }, 1500);
}
function abrirResumoPendenciasSelecionadas() {
    const sel = typeof cotacoesSelecionadas !== 'undefined' ? [...cotacoesSelecionadas] : [];
    if (!sel.length) return toast('Selecione ao menos uma cotação.');
    abrirResumoPendencias(sel);
}
// recalcula os dados (recalcular=true) ou só reaplica as caixinhas; descarta edições feitas à mão
function gerarResumoPendencias(recalcular) {
    const campo = document.getElementById('resumo-pend-pedidos'), area = document.getElementById('resumo-pend-texto'); if (!area) return;
    resumoPendPedidos = pedidosDoTextoResumo(campo ? campo.value : '');
    if (recalcular === true || !resumoPendTodos.length || recalcular === 'extras') resumoPendTodos = dadosResumoTodos(resumoPendPedidos);
    const op = rpOpcoes(), c = contagemResumo(resumoPendTodos);
    RP_TIPOS.forEach(k => { const el = document.getElementById('rp-n-' + k); if (el) el.textContent = c[k] + (k === 'nao' ? ' fornec.' : ' item(ns)'); });
    area.dataset.editado = '';
    area.value = textoResumoPendencias(resumoPendTodos, op);
    resumoPendPedidos = resumoPendTodos.filter(x => x.r.nao.length || x.r.forn.length || x.forcado).map(x => x.pedido);
    rpAtualizarPrevia();
}
function resumoPendOpcaoMudou() { rpGuardarOpcoes(); gerarResumoPendencias(); }
function rpAtualizarPrevia() {
    const el = document.getElementById('rp-previa'), area = document.getElementById('resumo-pend-texto'); if (!el || !area) return;
    const b = blocosResumoPendencias(area.value), e = escRel, s = assinaturaRelatorio();
    let h = `<div class="rp-dt">${e(b.data)}</div><div class="rp-tt">${e(b.titulo)}</div>${b.previa.map(t => `<div>${e(t)}</div>`).join('')}`;
    b.pedidos.forEach(p => {
        h += `<div class="rp-pd">PEDIDO ${e(p.num)}</div>`;
        p.toks.forEach(t => {
            if (t.k === 'rotulo') { if (!/^N[ãa]o entregaram/i.test(t.t)) h += `<div class="rp-rot">${e(t.t.toUpperCase())}</div>`; }
            else if (t.k === 'forn') h += `<div class="rp-fn">${e(t.t)}</div>`;
            else if (t.k === 'item') h += `<div class="rp-it">${e(t.t)}</div>`;
            else h += `<div>${e(t.t)}</div>`;
        });
        h += '<hr>';
    });
    h += `<div class="rp-ass"><b>${e(s.nome || '')}</b>${s.cargo ? ' · ' + e(s.cargo) : ''}</div><div class="rp-nt">${e(b.nota || '')}</div>`;
    el.innerHTML = h;
}
function resumoPendAlternarEdicao() {
    const a = document.getElementById('resumo-pend-texto'); if (!a) return;
    a.style.display = a.style.display === 'none' ? 'block' : 'none';
}
function resumoPendTextoEditado() { const a = document.getElementById('resumo-pend-texto'); if (a) a.dataset.editado = '1'; rpAtualizarPrevia(); }
function textoAtualResumo() { const a = document.getElementById('resumo-pend-texto'); return a ? a.value : ''; }
async function copiarResumoPendencias() {
    const t = textoAtualResumo(); if (!t.trim()) return toast('Não há pendências para exportar.');
    try { await navigator.clipboard.writeText(t); toast('✓ Resumo copiado.'); }
    catch (e) { const a = document.getElementById('resumo-pend-texto'); if (a) { a.focus(); a.select(); } toast('Selecione e copie o texto.'); }
}
async function baixarResumoPendencias(formato) {
    const texto = textoAtualResumo(); if (!texto.trim()) return toast('Não há pendências para exportar.');
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
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/47-resumo-pendencias.js'] = '2.37.0';
