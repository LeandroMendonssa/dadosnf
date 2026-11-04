// 45-exportar-cotacao.js — Relatório da cotação (básico e completo) em TXT, Word e PDF (2.23.0)
// Parte do script do app. Arquivo comum, carregado pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Um só levantamento (dadosRelatorioCotacao) alimenta os três formatos, então TXT, Word e PDF sempre dizem a mesma coisa.
// Nada aqui grava no banco: só lê o que o app já calcula (cotação, comparação com NF/ERP, entrega por fornecedor, auditorias).
//   Básico  = fornecedores ganhadores, recurso, quantidade de itens, valor total e status da entrega.
//   Completo = o básico + divergências por fornecedor + especificação dos itens + itens não entregues em destaque (entrega parcial).
// ===================================================================
const RELATORIO_COTACAO_NIVEIS = {
    basico: { rotulo: 'Básico', desc: 'Fornecedores ganhadores, recurso, quantidade de itens, valor total e status da entrega.' },
    completo: { rotulo: 'Completo', desc: 'Tudo do básico + divergências por fornecedor, especificação dos itens e, na entrega parcial, os itens não entregues em destaque.' }
};
let exportCotPedido = null, exportCotNivel = 'basico';

function moedaRelCot(n) { return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dataRelCot(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—'; }
function numRelCot(v) { const n = (typeof numeroFlexivel === 'function') ? numeroFlexivel(v) : Number(v); return Number.isFinite(n) ? n : null; }

function statusEntregaRelCot(e) {
    if (!e) return { rotulo: 'Pendente', detalhe: '', chave: 'pendente' };
    if (e.estado === 'cancelada') return { rotulo: 'Cancelada', detalhe: 'entrega cancelada', chave: 'cancelada' };
    if (e.estado === 'completa') return { rotulo: 'Concluída', detalhe: e.origem === 'manual' ? 'marcada manualmente como já chegou' : e.origem === 'parcial_resolvida' ? 'parcial marcada como resolvida' : '', chave: 'concluida' };
    if (e.estado === 'parcial' || e.estado === 'parcial_relatada') return { rotulo: 'Parcial', detalhe: `${e.cobertos}/${e.total} itens entregues${e.estado === 'parcial_relatada' ? ' · falta já relatada' : ''}`, chave: 'parcial' };
    if (e.estado === 'erp_sem_itens') return { rotulo: 'Pendente', detalhe: 'NF no ERP, itens/quantidades ainda não conferidos', chave: 'pendente' };
    return { rotulo: 'Pendente', detalhe: '', chave: 'pendente' };
}
function situacaoItemRelCot(e, codProduto) {
    if (e && e.estado === 'cancelada') return { rotulo: 'Cancelada', entregue: false, falta: false };
    if (e && e.estado === 'completa' && e.origem !== 'xml' && e.origem !== 'erp' && e.origem !== 'misto') return { rotulo: 'Entregue (manual)', entregue: true, falta: false };
    const i = e && (e.itens || []).find(x => x.codProduto === codProduto);
    const s = i ? i.situacao : 'pendente';
    if (s === 'nf' || s === 'erp' || s === 'resolvido') return { rotulo: 'Entregue', entregue: true, falta: false };
    if (s === 'parcial') return { rotulo: 'Parcial', entregue: false, falta: true };
    if (s === 'parcial_relatada') return { rotulo: 'Parcial (falta relatada)', entregue: false, falta: false };
    if (s === 'erp_sem_quantidade') return { rotulo: 'No ERP (quantidade não conferida)', entregue: false, falta: false };
    return { rotulo: 'Não entregue', entregue: false, falta: true };
}

function dadosRelatorioCotacao(pedido) {
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)); if (!cot) return null;
    const comp = compararFontesPedido(cot.pedido);
    const nota = (typeof listaAnotacoes !== 'undefined' ? listaAnotacoes : []).find(a => String(a.pedido) === String(cot.pedido));
    const todosItens = cot.itens || [];
    const vistos = new Set();
    const fornecedores = (cot.fornecedores || []).filter(f => {
        const ch = normalizarCnpj(f.cnpj); if (!ch || vistos.has(ch)) return false; vistos.add(ch);
        return todosItens.some(it => normalizarCnpj(it.cnpjFornecedor) === ch);
    }).map(f => {
        const ch = normalizarCnpj(f.cnpj);
        const itens = todosItens.filter(it => normalizarCnpj(it.cnpjFornecedor) === ch);
        const compForn = comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === ch);
        const e = calcularEntregaFornecedorPedido(cot.pedido, f, compForn);
        const st = statusEntregaRelCot(e);
        const recursosN = {};
        const itensRel = itens.map(it => {
            const recurso = (cot.recursosPorItem || {})[it.codProduto] || ((typeof recursoEsperadoPelaCotacao === 'function' && recursoEsperadoPelaCotacao(cot, it.codProduto)) || '') || 'Não definido';
            recursosN[recurso] = (recursosN[recurso] || 0) + 1;
            const qtd = numRelCot(it.quantidade), unit = numRelCot(it.precoUnitario);
            const totalNum = numRelCot(it.precoTotal) !== null ? numRelCot(it.precoTotal) : (qtd !== null && unit !== null ? qtd * unit : null);
            const sit = situacaoItemRelCot(e, it.codProduto);
            const nome = it.nomeOficial || it.descricao || it.codProduto || '(sem nome)';
            const original = it.nomeOficial && it.descricao && it.descricao !== it.nomeOficial ? it.descricao : '';
            const spec = [it.fabricante && it.fabricante !== '---' ? it.fabricante : '', it.embalagem || ''].filter(Boolean).join(' · ');
            return { cod: it.codProduto || '', nome, original, spec, quantidade: it.quantidade === undefined || it.quantidade === '' ? '—' : String(it.quantidade),
                unitario: unit !== null ? (typeof precoUnitarioTexto === 'function' ? precoUnitarioTexto(unit).replace('.', ',') : String(unit)) : '—',
                total: totalNum, recurso, situacao: sit.rotulo, entregue: sit.entregue, falta: sit.falta };
        });
        // divergências: auditorias já registradas (status próprio) + o que o app detectou e ninguém relatou ainda
        const divergencias = [];
        (nota && nota.ocorrencias || []).filter(oc => normalizarCnpj(oc.fornecedorCnpj) === ch).forEach(oc => (oc.divergencias || []).forEach(d => {
            let linhas = []; try { linhas = linhasDeMateriais(d); } catch (err) { /* tipo antigo */ }
            if (!linhas.length) return;
            const def = (typeof TIPOS_DIVERGENCIA_AUDITORIA !== 'undefined' && TIPOS_DIVERGENCIA_AUDITORIA[d.tipo]) || null;
            const status = d.status || 'pendente';
            const naoRelatada = status === 'pendente' && d.relatado === false;
            divergencias.push({ tipo: def ? def.label : 'Divergência', status: naoRelatada ? 'Gerada, ainda não relatada' : status === 'pendente' ? 'Pendência relatada' : status === 'resolvida' ? 'Resolvida' : 'Encerrada', nf: oc.notaFiscal || '', linhas });
        }));
        compForn.filter(x => x.estado === 'detectada').forEach(x => {
            const linhas = (x.divergencias || []).filter(d => d.tipo !== 'nao_faturado').map(d => { try { return textoDivergenciaNatural(d); } catch (err) { return ''; } }).filter(Boolean);
            if (linhas.length) divergencias.push({ tipo: 'Detectada pelo app', status: 'Sem relato', nf: '', linhas });
        });
        return {
            nome: nomeExibicaoFornecedor(f.razaoSocial, f.cnpj), cnpj: f.cnpj || '',
            recursos: Object.entries(recursosN).map(([rotulo, n]) => ({ rotulo, n })),
            qtdItens: itens.length, valorTotal: itens.reduce((s, i) => s + (i.total || 0), 0) || valorTotalCotacaoPorFornecedor(cot, f.cnpj),
            status: st, itens: itensRel, faltando: itensRel.filter(i => i.falta), divergencias
        };
    });
    // valor do fornecedor = soma dos itens (mesma conta da tela); recalcula com a função oficial para não divergir
    fornecedores.forEach(f => { const forn = (cot.fornecedores || []).find(x => normalizarCnpj(x.cnpj) === normalizarCnpj(f.cnpj)); if (forn) f.valorTotal = valorTotalCotacaoPorFornecedor(cot, forn.cnpj); });
    return {
        pedido: String(cot.pedido), origem: cot.origem || '', dataPedido: cot.dataPedido || '', dataLimite: cot.dataLimite || '',
        geradoEm: new Date().toLocaleString('pt-BR'), fornecedores,
        totais: { fornecedores: fornecedores.length, itens: fornecedores.reduce((s, f) => s + f.qtdItens, 0), valor: fornecedores.reduce((s, f) => s + (f.valorTotal || 0), 0) }
    };
}

// ---------- TXT ----------
function textoRelatorioCotacao(d, nivel) {
    const L = [], completo = nivel === 'completo', linha = '─'.repeat(34);
    L.push(`COTAÇÃO ${d.pedido} — RELATÓRIO ${completo ? 'COMPLETO' : 'BÁSICO'}`);
    L.push([d.origem && `Origem: ${d.origem}`, `Pedido em ${dataRelCot(d.dataPedido)}`, `Limite de entrega ${dataRelCot(d.dataLimite)}`].filter(Boolean).join(' · '));
    L.push(`Gerado em ${d.geradoEm}`);
    L.push(`${d.totais.fornecedores} fornecedor(es) ganhador(es) · ${d.totais.itens} item(ns) · ${moedaRelCot(d.totais.valor)}`);
    d.fornecedores.forEach((f, i) => {
        L.push(''); L.push(linha);
        L.push(`${i + 1}. ${f.nome.toUpperCase()}${f.cnpj ? ' (' + (typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj) + ')' : ''}`);
        L.push(`Recurso: ${f.recursos.map(r => f.recursos.length > 1 ? `${r.rotulo} (${r.n} ${r.n === 1 ? 'item' : 'itens'})` : r.rotulo).join(' · ')}`);
        L.push(`Itens: ${f.qtdItens} · Valor total: ${moedaRelCot(f.valorTotal)}`);
        L.push(`Entrega: ${f.status.rotulo}${f.status.detalhe ? ' — ' + f.status.detalhe : ''}`);
        if (!completo) return;
        if (f.status.chave === 'parcial' && f.faltando.length) {
            L.push(`>>> ITENS NÃO ENTREGUES (${f.faltando.length}):`);
            f.faltando.forEach(it => L.push(`    ► ${it.nome} — ${it.quantidade} un.`));
        }
        L.push(f.divergencias.length ? `Divergências (${f.divergencias.length}):` : 'Divergências: nenhuma');
        f.divergencias.forEach(v => { L.push(`  - ${v.tipo} [${v.status}]${v.nf ? ' · NF ' + v.nf : ''}`); v.linhas.forEach(t => L.push(`      ${t}`)); });
        L.push('Itens:');
        f.itens.forEach(it => {
            L.push(`  • ${it.cod ? it.cod + ' · ' : ''}${it.nome}${it.spec ? ' — ' + it.spec : ''}`);
            if (it.original) L.push(`      Descrição: ${it.original}`);
            L.push(`      ${it.quantidade} un. × R$ ${it.unitario} = ${it.total !== null ? moedaRelCot(it.total) : '—'} · ${it.recurso} · ${it.falta && f.status.chave === 'parcial' ? 'NÃO ENTREGUE ►' : it.situacao}`);
        });
    });
    return L.join('\n') + '\n';
}

// ---------- Word (.doc em HTML: abre no Word, Pages e Google Docs) ----------
function htmlRelatorioCotacao(d, nivel) {
    const completo = nivel === 'completo', e = escRel;
    const corStatus = { concluida: '#1b7f3b', parcial: '#b26a00', pendente: '#555555', cancelada: '#777777' };
    let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Cotação ${e(d.pedido)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:13pt;margin:16pt 0 4pt;border-bottom:1px solid #999;padding-bottom:2pt}
table{border-collapse:collapse;width:100%;margin:4pt 0}th,td{border:1px solid #bbb;padding:3pt 5pt;font-size:10pt;vertical-align:top;text-align:left}th{background:#eee}
.meta{color:#555;font-size:10pt}.falta td{background:#fde8e8;color:#a00018;font-weight:bold}.dest{background:#fde8e8;border:1px solid #d33;padding:4pt 6pt;color:#a00018;font-weight:bold;margin:4pt 0}.sub{font-size:9pt;color:#666}</style></head><body>`;
    h += `<h1>Cotação ${e(d.pedido)} — Relatório ${completo ? 'completo' : 'básico'}</h1>`;
    h += `<p class="meta">${[d.origem && 'Origem: ' + e(d.origem), 'Pedido em ' + dataRelCot(d.dataPedido), 'Limite de entrega ' + dataRelCot(d.dataLimite), 'Gerado em ' + e(d.geradoEm)].filter(Boolean).join(' · ')}</p>`;
    h += `<p><b>${d.totais.fornecedores}</b> fornecedor(es) ganhador(es) · <b>${d.totais.itens}</b> item(ns) · <b>${moedaRelCot(d.totais.valor)}</b></p>`;
    const recTxt = f => f.recursos.map(r => f.recursos.length > 1 ? `${e(r.rotulo)} (${r.n})` : e(r.rotulo)).join('<br>');
    const stHtml = f => `<b style="color:${corStatus[f.status.chave]}">${e(f.status.rotulo)}</b>${f.status.detalhe ? `<br><span class="sub">${e(f.status.detalhe)}</span>` : ''}`;
    if (!completo) {
        h += `<table><tr><th>Fornecedor ganhador</th><th>Recurso</th><th>Itens</th><th>Valor total</th><th>Entrega</th></tr>`;
        d.fornecedores.forEach(f => { h += `<tr><td>${e(f.nome)}</td><td>${recTxt(f)}</td><td>${f.qtdItens}</td><td>${moedaRelCot(f.valorTotal)}</td><td>${stHtml(f)}</td></tr>`; });
        return h + '</table></body></html>';
    }
    d.fornecedores.forEach((f, i) => {
        h += `<h2>${i + 1}. ${e(f.nome)}</h2><p class="meta">${f.cnpj ? 'CNPJ ' + e(typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj) + ' · ' : ''}Recurso: ${recTxt(f).replace(/<br>/g, ' · ')}</p>`;
        h += `<table><tr><th>Itens</th><th>Valor total</th><th>Entrega</th></tr><tr><td>${f.qtdItens}</td><td>${moedaRelCot(f.valorTotal)}</td><td>${stHtml(f)}</td></tr></table>`;
        if (f.status.chave === 'parcial' && f.faltando.length) h += `<div class="dest">ITENS NÃO ENTREGUES (${f.faltando.length}): ${f.faltando.map(it => e(it.nome) + ' — ' + e(it.quantidade) + ' un.').join('; ')}</div>`;
        h += `<p><b>Divergências</b>${f.divergencias.length ? '' : ': nenhuma'}</p>`;
        if (f.divergencias.length) h += '<ul>' + f.divergencias.map(v => `<li><b>${e(v.tipo)}</b> <span class="sub">[${e(v.status)}]${v.nf ? ' · NF ' + e(v.nf) : ''}</span><br>${v.linhas.map(e).join('<br>')}</li>`).join('') + '</ul>';
        h += `<table><tr><th>Cód.</th><th>Item e especificação</th><th>Qtd</th><th>Unit.</th><th>Total</th><th>Recurso</th><th>Entrega</th></tr>`;
        f.itens.forEach(it => {
            h += `<tr${it.falta && f.status.chave === 'parcial' ? ' class="falta"' : ''}><td>${e(it.cod)}</td><td>${e(it.nome)}${it.spec ? `<br><span class="sub">${e(it.spec)}</span>` : ''}${it.original ? `<br><span class="sub">${e(it.original)}</span>` : ''}</td><td>${e(it.quantidade)}</td><td>${e(it.unitario)}</td><td>${it.total !== null ? moedaRelCot(it.total) : '—'}</td><td>${e(it.recurso)}</td><td>${e(it.falta && f.status.chave === 'parcial' ? 'NÃO ENTREGUE' : it.situacao)}</td></tr>`;
        });
        h += '</table>';
    });
    return h + '</body></html>';
}

// ---------- PDF (jsPDF) ----------
function gerarPdfRelatorioCotacao(d, nivel) {
    const { jsPDF } = jspdf, completo = nivel === 'completo';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40, LARG = W - 2 * M;
    let y = M;
    const nova = alt => { if (y + alt > H - M) { doc.addPage(); y = M; } };
    const txt = (t, o = {}) => {
        const tam = o.size || 10, ind = o.indent || 0;
        doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(tam);
        const cor = o.cor || [34, 34, 34]; doc.setTextColor(cor[0], cor[1], cor[2]);
        doc.splitTextToSize(String(t), LARG - ind).forEach(l => { nova(tam + 4); doc.text(l, M + ind, y + tam); y += tam + 3.5; });
    };
    const regua = () => { nova(10); doc.setDrawColor(170); doc.line(M, y + 2, W - M, y + 2); y += 8; };
    const logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : (appConfig.personalizacao && appConfig.personalizacao.logoBase64);
    if (logo) { try { doc.addImage(logo, 'PNG', W - M - 55, M - 8, 55, 42); } catch (err) { /* logo inválida: segue sem */ } }
    txt(`Cotação ${d.pedido} — Relatório ${completo ? 'completo' : 'básico'}`, { size: 16, bold: true });
    txt([d.origem && 'Origem: ' + d.origem, 'Pedido em ' + dataRelCot(d.dataPedido), 'Limite de entrega ' + dataRelCot(d.dataLimite)].filter(Boolean).join('  ·  '), { size: 9, cor: [90, 90, 90] });
    txt('Gerado em ' + d.geradoEm, { size: 9, cor: [90, 90, 90] });
    y += 4; txt(`${d.totais.fornecedores} fornecedor(es) ganhador(es)  ·  ${d.totais.itens} item(ns)  ·  ${moedaRelCot(d.totais.valor)}`, { bold: true, size: 11 });
    const corSt = { concluida: [27, 127, 59], parcial: [178, 106, 0], pendente: [85, 85, 85], cancelada: [119, 119, 119] };
    const VERM = [176, 0, 32];
    d.fornecedores.forEach((f, i) => {
        y += 8; nova(60); regua();
        txt(`${i + 1}. ${f.nome}`, { size: 12, bold: true });
        if (f.cnpj) txt('CNPJ ' + (typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj), { size: 9, cor: [90, 90, 90] });
        txt('Recurso: ' + f.recursos.map(r => f.recursos.length > 1 ? `${r.rotulo} (${r.n} ${r.n === 1 ? 'item' : 'itens'})` : r.rotulo).join('  ·  '));
        txt(`Itens: ${f.qtdItens}   ·   Valor total: ${moedaRelCot(f.valorTotal)}`);
        txt(`Entrega: ${f.status.rotulo}${f.status.detalhe ? ' — ' + f.status.detalhe : ''}`, { bold: true, cor: corSt[f.status.chave] });
        if (!completo) return;
        if (f.status.chave === 'parcial' && f.faltando.length) {
            y += 3; txt(`ITENS NÃO ENTREGUES (${f.faltando.length})`, { bold: true, cor: VERM });
            f.faltando.forEach(it => txt(`> ${it.nome} — ${it.quantidade} un.`, { bold: true, cor: VERM, indent: 10 }));
        }
        y += 3; txt(f.divergencias.length ? `Divergências (${f.divergencias.length})` : 'Divergências: nenhuma', { bold: true });
        f.divergencias.forEach(v => { txt(`- ${v.tipo} [${v.status}]${v.nf ? ' · NF ' + v.nf : ''}`, { indent: 8, bold: true, size: 9 }); v.linhas.forEach(t => txt(t, { indent: 18, size: 9 })); });
        y += 3; txt('Itens', { bold: true });
        f.itens.forEach(it => {
            const falta = it.falta && f.status.chave === 'parcial';
            txt(`${it.cod ? it.cod + ' · ' : ''}${it.nome}${it.spec ? ' — ' + it.spec : ''}`, { indent: 8, size: 9.5, bold: true, cor: falta ? VERM : [34, 34, 34] });
            if (it.original) txt(`Descrição: ${it.original}`, { indent: 18, size: 8.5, cor: [100, 100, 100] });
            txt(`${it.quantidade} un. × R$ ${it.unitario} = ${it.total !== null ? moedaRelCot(it.total) : '—'}  ·  ${it.recurso}  ·  ${falta ? 'NÃO ENTREGUE' : it.situacao}`, { indent: 18, size: 9, cor: falta ? VERM : [70, 70, 70] });
        });
    });
    return doc;
}

// ---------- janela de exportação ----------
function abrirExportarCotacao(pedido) {
    if (!pedido) return;
    exportCotPedido = String(pedido); exportCotNivel = 'basico';
    escolherNivelExportCotacao('basico');
    const sub = document.getElementById('export-cot-sub'); if (sub) sub.textContent = `Pedido ${pedido}`;
    const m = document.getElementById('export-cot-modal'); if (m) m.classList.add('active');
}
function escolherNivelExportCotacao(n) {
    exportCotNivel = n;
    document.querySelectorAll('#export-cot-modal [data-nivel]').forEach(b => b.classList.toggle('active', b.dataset.nivel === n));
    const dsc = document.getElementById('export-cot-desc'); if (dsc) dsc.textContent = RELATORIO_COTACAO_NIVEIS[n].desc;
}
async function entregarArquivoRelCot(nome, blob) {
    try {
        const f = typeof File === 'function' ? new File([blob], nome, { type: blob.type }) : null;
        if (f && /iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [f] })) {
            try { await navigator.share({ files: [f], title: nome }); return true; } catch (err) { if (err && err.name === 'AbortError') return false; }
        }
    } catch (err) { /* cai no download */ }
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
    return true;
}
async function exportarCotacaoRelatorio(formato) {
    const pedido = exportCotPedido, nivel = exportCotNivel;
    let d; try { d = dadosRelatorioCotacao(pedido); } catch (err) { console.error('Relatório da cotação:', err); return toast('✕ Não foi possível montar o relatório.'); }
    if (!d) return toast('Cotação não encontrada.');
    if (!d.fornecedores.length) return toast('Esta cotação ainda não tem itens com fornecedor ganhador.');
    const base = `Cotacao-${String(pedido).replace(/[^\w-]+/g, '_')}-${nivel}`;
    try {
        let ok = false;
        if (formato === 'txt') ok = await entregarArquivoRelCot(base + '.txt', new Blob([textoRelatorioCotacao(d, nivel)], { type: 'text/plain;charset=utf-8' }));
        else if (formato === 'doc') ok = await entregarArquivoRelCot(base + '.doc', new Blob(['﻿', htmlRelatorioCotacao(d, nivel)], { type: 'application/msword' }));
        else {
            if (typeof jspdf === 'undefined') return toast('✕ A biblioteca de PDF ainda não carregou — aguarde um instante e tente de novo.');
            ok = await entregarArquivoRelCot(base + '.pdf', gerarPdfRelatorioCotacao(d, nivel).output('blob'));
        }
        if (ok) { closeAllModals(); toast('✓ Relatório gerado.'); }
    } catch (err) { console.error('Exportar cotação:', err); toast('✕ Erro ao gerar o relatório.'); }
}
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/45-exportar-cotacao.js'] = '2.23.1';
