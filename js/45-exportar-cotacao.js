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
        geradoEm: new Date().toLocaleString('pt-BR'), obsPedido: String(cot.observacao || '').trim(), fornecedores,
        totais: { fornecedores: fornecedores.length, itens: fornecedores.reduce((s, f) => s + f.qtdItens, 0), valor: fornecedores.reduce((s, f) => s + (f.valorTotal || 0), 0) }
    };
}

// ---------- apoio visual (o mesmo padrão de cores no TXT, Word e PDF) ----------
const RC_COR = {
    concluida: { bg: '#dff3e5', fg: '#1b6e36' }, parcial: { bg: '#fff0d1', fg: '#995c00' }, pendente: { bg: '#e8ebf0', fg: '#4a5568' }, cancelada: { bg: '#ececec', fg: '#777777' },
    aberto: { bg: '#fde2e2', fg: '#b3201f' }, relatada: { bg: '#fff0d1', fg: '#995c00' }, resolvida: { bg: '#dff3e5', fg: '#1b6e36' }
};
const RC_AZUL = '#1f3a5f', RC_VERM = '#c62828', RC_OBS = '#1565c0';
function rgbRelCot(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function chaveStatusDivRelCot(s) { return s === 'Resolvida' || s === 'Encerrada' ? 'resolvida' : s === 'Pendência relatada' ? 'relatada' : 'aberto'; }
function rotuloStatusDivRelCot(s) { return s === 'Pendência relatada' ? 'Relatada' : s === 'Resolvida' ? 'Resolvida' : s === 'Encerrada' ? 'Encerrada' : 'Em aberto'; }
function detalheStatusRelCot(f) { return f.status.detalhe || ({ concluida: 'entrega concluída', pendente: 'nenhuma NF recebida ainda', cancelada: 'entrega cancelada', parcial: '' }[f.status.chave] || ''); }
function entregaItemRelCot(f, it) { return f.status.chave === 'pendente' && it.situacao === 'Não entregue' ? 'Aguardando' : it.situacao; }
function ehFaltaRelCot(f, it) { return f.status.chave === 'parcial' && it.falta; }
function contagemEntregasRelCot(d) { const c = {}; d.fornecedores.forEach(f => { c[f.status.chave] = (c[f.status.chave] || 0) + 1; }); return c; }
const NOME_ENTREGA_RELCOT = { concluida: 'Concluída', parcial: 'Parcial', pendente: 'Pendente', cancelada: 'Cancelada' };
function especItemRelCot(f, it) { return [it.spec, f.recursos.length > 1 ? 'Recurso: ' + it.recurso : ''].filter(Boolean).join(' · '); }
function cabecalhoRelCot(d, nivel) { return [d.origem && 'Origem: ' + d.origem, 'Pedido em ' + dataRelCot(d.dataPedido), 'Limite de entrega ' + dataRelCot(d.dataLimite), 'Relatório ' + (nivel === 'completo' ? 'completo' : 'básico'), 'Gerado em ' + d.geradoEm].filter(Boolean); }

// ---------- TXT ----------
function textoRelatorioCotacao(d, nivel) {
    const L = [], completo = nivel === 'completo', linha = '─'.repeat(34);
    L.push(`COTAÇÃO ${d.pedido} — RELATÓRIO ${completo ? 'COMPLETO' : 'BÁSICO'}`);
    L.push(cabecalhoRelCot(d, nivel).slice(0, 3).join(' · '));
    L.push(`Gerado em ${d.geradoEm}`);
    const ce = contagemEntregasRelCot(d);
    L.push(`${d.totais.fornecedores} fornecedor(es) ganhador(es) · ${d.totais.itens} item(ns) · ${moedaRelCot(d.totais.valor)}`);
    L.push('Entregas: ' + Object.keys(ce).map(k => `${ce[k]} ${NOME_ENTREGA_RELCOT[k]}`).join(' · '));
    if (completo) { L.push('Legenda: [DIVERGÊNCIA] diferença entre o pedido e o que veio (NF/ERP) · [OBSERVAÇÃO] o que veio do SmartCompras · ► item não entregue'); if (d.obsPedido) L.push(`[OBSERVAÇÃO] Do pedido: ${d.obsPedido}`); }
    d.fornecedores.forEach((f, i) => {
        L.push(''); L.push(linha);
        L.push(`${i + 1}. ${f.nome.toUpperCase()}${f.cnpj ? ' (' + (typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj) + ')' : ''}`);
        L.push(`Recurso: ${f.recursos.map(r => f.recursos.length > 1 ? `${r.rotulo} (${r.n} ${r.n === 1 ? 'item' : 'itens'})` : r.rotulo).join(' · ')}`);
        L.push(`Itens: ${f.qtdItens} · Valor total: ${moedaRelCot(f.valorTotal)}`);
        L.push(`Entrega: ${f.status.rotulo}${detalheStatusRelCot(f) ? ' — ' + detalheStatusRelCot(f) : ''}`);
        if (!completo) return;
        if (f.status.chave === 'parcial' && f.faltando.length) {
            L.push(`>>> ITENS NÃO ENTREGUES (${f.faltando.length}):`);
            f.faltando.forEach(it => L.push(`    ► ${it.nome} — ${it.quantidade} un.`));
        }
        if (!f.divergencias.length) L.push('Divergências: nenhuma registrada');
        f.divergencias.forEach(v => { L.push(`[DIVERGÊNCIA] ${v.tipo} — ${rotuloStatusDivRelCot(v.status)}${v.nf ? ' · NF ' + v.nf : ''}`); v.linhas.forEach(t => L.push(`      ${t}`)); });
        L.push('Itens:');
        f.itens.forEach(it => {
            const falta = ehFaltaRelCot(f, it);
            L.push(`  ${falta ? '►' : '•'} ${it.cod ? it.cod + ' · ' : ''}${it.nome}${especItemRelCot(f, it) ? ' — ' + especItemRelCot(f, it) : ''}`);
            if (it.original) L.push(`      [OBSERVAÇÃO] SmartCompras: ${it.original}`);
            L.push(`      ${it.quantidade} un. × R$ ${it.unitario} = ${it.total !== null ? moedaRelCot(it.total) : '—'} · ${falta ? 'NÃO ENTREGUE' : entregaItemRelCot(f, it)}`);
        });
    });
    return L.join('\n') + '\n';
}

// ---------- Word (.doc em HTML: abre no Word, Pages e Google Docs) — layout em tabelas, que o Word entende ----------
function htmlRelatorioCotacao(d, nivel) {
    const completo = nivel === 'completo', e = escRel;
    const pill = (k, t) => `<span style="background:${RC_COR[k].bg};color:${RC_COR[k].fg};font-weight:bold;font-size:8pt;padding:1pt 6pt;">&nbsp;${e(t)}&nbsp;</span>`;
    const logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : null;
    const ce = contagemEntregasRelCot(d);
    let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Cotação ${e(d.pedido)}</title>
<style>@page{size:21cm 29.7cm;margin:1.4cm 1.3cm}body{font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#222}table{border-collapse:collapse}td,th{vertical-align:top}
h1{font-size:17pt;color:${RC_AZUL};margin:0}.sub{color:#5a6678;font-size:9pt;margin:2pt 0 0}.k{font-size:15pt;font-weight:bold;color:${RC_AZUL}}.kl{font-size:7.5pt;color:#6b778a;text-transform:uppercase}
th{background:${RC_AZUL};color:#fff;font-size:8pt;text-align:left;padding:4pt 5pt;text-transform:uppercase}td.c{border-bottom:1px solid #e3e8ef;padding:4pt 5pt;font-size:9pt}.r{text-align:right;white-space:nowrap}
h2{font-size:10.5pt;color:${RC_AZUL};margin:12pt 0 4pt;text-transform:uppercase}.s2{font-size:8pt;color:#6b778a}.so{font-size:8pt;color:${RC_OBS}}</style></head><body>`;
    h += `<table width="100%" style="border-bottom:3px solid ${RC_AZUL};margin-bottom:8pt"><tr>${logo ? `<td width="80" style="padding-bottom:6pt"><img src="${logo}" width="74" height="56"></td>` : ''}<td style="padding-bottom:6pt"><h1>Relatório da cotação · Pedido ${e(d.pedido)}</h1><p class="sub">${cabecalhoRelCot(d, nivel).map(e).join(' · ')}</p></td></tr></table>`;
    h += `<table width="100%" cellspacing="6"><tr>
<td bgcolor="#f7f9fc" style="border:1px solid #d5dbe5;padding:5pt 8pt"><div class="k">${d.totais.fornecedores}</div><div class="kl">Fornecedores ganhadores</div></td>
<td bgcolor="#f7f9fc" style="border:1px solid #d5dbe5;padding:5pt 8pt"><div class="k">${d.totais.itens}</div><div class="kl">Itens</div></td>
<td bgcolor="#f7f9fc" style="border:1px solid #d5dbe5;padding:5pt 8pt"><div class="k">${moedaRelCot(d.totais.valor)}</div><div class="kl">Valor total</div></td>
<td bgcolor="#f7f9fc" style="border:1px solid #d5dbe5;padding:5pt 8pt"><div class="kl">Entregas</div><div style="margin-top:3pt">${Object.keys(ce).map(k => pill(k, ce[k] + ' ' + NOME_ENTREGA_RELCOT[k])).join(' ')}</div></td></tr></table>`;
    if (completo) h += `<table width="100%" style="border:1px solid #e1e6ee;margin:6pt 0"><tr><td style="padding:4pt 8pt;font-size:8pt;color:#4a5568"><span style="color:${RC_VERM}">■</span> <b>DIVERGÊNCIA</b> — diferença entre o pedido e o que veio (NF/ERP) &nbsp;&nbsp; <span style="color:${RC_OBS}">■</span> <b>OBSERVAÇÃO</b> — o que veio do SmartCompras (observação do pedido e comentário de cada item) &nbsp;&nbsp; <span style="color:#f2b8b8">■</span> <b>Linha rosada</b> — item não entregue</td></tr></table>`;
    h += `<h2>Resumo por fornecedor</h2><table width="100%"><tr><th>Fornecedor ganhador</th><th>Recurso</th><th class="r">Itens</th><th class="r">Valor total</th><th>Entrega</th></tr>`;
    d.fornecedores.forEach(f => {
        h += `<tr><td class="c"><b>${e(f.nome)}</b></td><td class="c">${f.recursos.map(r => f.recursos.length > 1 ? `${e(r.rotulo)} (${r.n})` : e(r.rotulo)).join('<br>')}</td><td class="c r">${f.qtdItens}</td><td class="c r">${moedaRelCot(f.valorTotal)}</td><td class="c">${pill(f.status.chave, f.status.rotulo)}${detalheStatusRelCot(f) ? `<br><span class="s2">${e(detalheStatusRelCot(f))}</span>` : ''}</td></tr>`;
    });
    h += '</table>';
    if (!completo) return h + '</body></html>';
    h += '<h2>Detalhe por fornecedor</h2>';
    const caixa = (cor, fundo, tag, corpo) => `<table width="100%" style="margin:4pt 0"><tr><td bgcolor="${fundo}" style="border-left:5px solid ${cor};padding:4pt 8pt;font-size:9pt"><b style="color:${cor};font-size:7.5pt">${tag}</b>&nbsp; ${corpo}</td></tr></table>`;
    if (d.obsPedido) h += caixa(RC_OBS, '#f1f7ff', 'OBSERVAÇÃO', `<b>Do pedido (SmartCompras):</b> ${e(d.obsPedido)}`);
    d.fornecedores.forEach((f, i) => {
        h += `<table width="100%" style="border:1px solid #cfd7e3;margin:10pt 0 0"><tr><td bgcolor="#eef2f8" style="padding:5pt 8pt;border-bottom:1px solid #cfd7e3"><table width="100%"><tr><td><b style="font-size:11pt;color:${RC_AZUL}">${i + 1}. ${e(f.nome)}</b><br><span class="s2">CNPJ ${e(typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj)}</span></td><td align="right">${pill(f.status.chave, f.status.rotulo)}</td></tr></table></td></tr><tr><td style="padding:5pt 8pt">`;
        h += `<table><tr><td style="padding-right:18pt"><span class="s2">RECURSO</span><br><b>${f.recursos.map(r => f.recursos.length > 1 ? `${e(r.rotulo)} (${r.n})` : e(r.rotulo)).join(' · ')}</b></td><td style="padding-right:18pt"><span class="s2">ITENS</span><br><b>${f.qtdItens}</b></td><td><span class="s2">VALOR TOTAL</span><br><b>${moedaRelCot(f.valorTotal)}</b></td></tr></table>`;
        if (f.status.chave === 'parcial' && f.faltando.length) h += `<table width="100%" style="margin:5pt 0;border:1.5px solid ${RC_VERM}"><tr><td bgcolor="#fdecec" style="padding:4pt 8pt;color:#9b1c1c"><b style="font-size:8.5pt">ITENS NÃO ENTREGUES (${f.faltando.length})</b><br>${f.faltando.map(it => '• ' + e(it.nome) + ' — ' + e(it.quantidade) + ' un.').join('<br>')}</td></tr></table>`;
        f.divergencias.forEach(v => { h += caixa(RC_VERM, '#fff6f6', 'DIVERGÊNCIA', `<b>${e(v.tipo)}</b> ${pill(chaveStatusDivRelCot(v.status), rotuloStatusDivRelCot(v.status))}${v.nf ? ` <span class="s2">· NF ${e(v.nf)}</span>` : ''}<br>${v.linhas.map(e).join('<br>')}`); });
        if (!f.divergencias.length) h += `<p style="color:#1b6e36;font-size:8.5pt;margin:4pt 0">✓ Nenhuma divergência registrada para este fornecedor.</p>`;
        h += `<table width="100%" style="margin-top:4pt"><tr><th width="9%">Cód.</th><th>Item e especificação</th><th width="8%" class="r">Qtd</th><th width="9%" class="r">Unit.</th><th width="13%" class="r">Total</th><th width="15%">Entrega</th></tr>`;
        f.itens.forEach(it => {
            const falta = ehFaltaRelCot(f, it), sit = falta ? 'Não entregue' : entregaItemRelCot(f, it);
            const est = falta ? ' bgcolor="#fdecec" style="color:#9b1c1c;font-weight:bold"' : (it.situacao === 'Cancelada' ? ' style="color:#999"' : '');
            h += `<tr${est}><td class="c">${e(it.cod)}</td><td class="c">${e(it.nome)}${especItemRelCot(f, it) ? `<br><span class="s2">${e(especItemRelCot(f, it))}</span>` : ''}${it.original ? `<br><span class="so">ℹ SmartCompras: ${e(it.original)}</span>` : ''}</td><td class="c r">${e(it.quantidade)}</td><td class="c r">${e(it.unitario)}</td><td class="c r">${it.total !== null ? moedaRelCot(it.total) : '—'}</td><td class="c">${falta ? '✖ ' : (it.entregue ? '✓ ' : '')}${e(sit)}</td></tr>`;
        });
        h += '</table></td></tr></table>';
    });
    return h + '</body></html>';
}

// ---------- PDF (jsPDF) — desenhado à mão para ficar igual ao Word ----------
function gerarPdfRelatorioCotacao(d, nivel) {
    const { jsPDF } = jspdf, completo = nivel === 'completo';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 38, LARG = W - 2 * M, RODAPE = 28;
    let y = M;
    const fill = h => { const c = rgbRelCot(h); doc.setFillColor(c[0], c[1], c[2]); }, draw = h => { const c = rgbRelCot(h); doc.setDrawColor(c[0], c[1], c[2]); }, ink = h => { const c = rgbRelCot(h); doc.setTextColor(c[0], c[1], c[2]); };
    const fonte = (tam, neg) => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); };
    const quebra = (t, larg, tam, neg) => { fonte(tam, neg); return doc.splitTextToSize(String(t), Math.max(20, larg)); };
    const espaco = alt => { if (y + alt > H - RODAPE) { doc.addPage(); y = M; return true; } return false; };
    // texto corrido com cor/negrito; devolve a altura usada
    const texto = (t, x, larg, o = {}) => { const tam = o.size || 9, lin = quebra(t, larg, tam, o.bold); ink(o.cor || '#222222'); lin.forEach((l, i) => doc.text(l, x, y + tam + i * (tam * 1.28) - 2)); return lin.length * tam * 1.28; };
    const pill = (k, t, x, yy, alinhaDireita) => { // selo arredondado; (x,yy) = canto sup. esq. (ou dir., se alinhaDireita)
        fonte(7.5, true); const w = doc.getTextWidth(t) + 12, xx = alinhaDireita ? x - w : x;
        fill(RC_COR[k].bg); doc.roundedRect(xx, yy, w, 12, 6, 6, 'F'); ink(RC_COR[k].fg); doc.text(t, xx + 6, yy + 8.6); return w; };
    const logo = (typeof logoParaImpressao === 'function') ? logoParaImpressao() : null;

    // cabeçalho
    let xT = M; if (logo) { try { doc.addImage(logo, 'PNG', M, y - 4, 55, 42); xT = M + 66; } catch (err) { /* logo inválida: segue sem */ } }
    fonte(17, true); ink(RC_AZUL); doc.text(`Relatório da cotação · Pedido ${d.pedido}`, xT, y + 14);
    const sub = quebra(cabecalhoRelCot(d, nivel).join(' · '), W - M - xT, 8.5); fonte(8.5); ink('#5a6678'); sub.forEach((l, i) => doc.text(l, xT, y + 28 + i * 11));
    y += Math.max(46, 28 + sub.length * 11 + 6); fill(RC_AZUL); doc.rect(M, y, LARG, 2.5, 'F'); y += 12;
    // totais
    const ce = contagemEntregasRelCot(d), kw = (LARG - 18) / 4.4;
    const kpi = (i, v, rot, larg) => { const x = M + i * (kw + 6); fill('#f7f9fc'); draw('#d5dbe5'); doc.roundedRect(x, y, larg || kw, 38, 5, 5, 'FD'); fonte(13, true); ink(RC_AZUL); doc.text(String(v), x + 8, y + 17); fonte(6.8); ink('#6b778a'); doc.text(rot.toUpperCase(), x + 8, y + 29); };
    kpi(0, d.totais.fornecedores, 'Fornecedores'); kpi(1, d.totais.itens, 'Itens'); kpi(2, moedaRelCot(d.totais.valor), 'Valor total');
    const xe = M + 3 * (kw + 6), le = LARG - 3 * (kw + 6); fill('#f7f9fc'); draw('#d5dbe5'); doc.roundedRect(xe, y, le, 38, 5, 5, 'FD'); fonte(6.8); ink('#6b778a'); doc.text('ENTREGAS', xe + 8, y + 11);
    let px = xe + 8, py = y + 16; Object.keys(ce).forEach(k => { const t = `${ce[k]} ${NOME_ENTREGA_RELCOT[k]}`; fonte(7.5, true); const w = doc.getTextWidth(t) + 12; if (px + w > xe + le - 4) { px = xe + 8; py += 14; } pill(k, t, px, py); px += w + 4; });
    y += 46;
    if (completo) { // legenda
        fill('#ffffff'); draw('#e1e6ee'); doc.roundedRect(M, y, LARG, 24, 5, 5, 'FD');
        const it = [[RC_VERM, 'DIVERGÊNCIA', ' — pedido × NF/ERP'], [RC_OBS, 'OBSERVAÇÃO', ' — do SmartCompras'], ['#f2b8b8', 'Linha rosada', ' — item não entregue']];
        let lx = M + 8; it.forEach(([c, a, b]) => { fill(c); doc.rect(lx, y + 9, 7, 7, 'F'); fonte(7.2, true); ink('#4a5568'); doc.text(a, lx + 10, y + 15); const wa = doc.getTextWidth(a); fonte(7.2); doc.text(b, lx + 10 + wa, y + 15); lx += 10 + wa + doc.getTextWidth(b) + 12; });
        y += 32;
    }
    const titulo = t => { espaco(40); fonte(10, true); ink(RC_AZUL); doc.text(t.toUpperCase(), M, y + 10); y += 18; };
    // tabela genérica: cols [{t, w, r}]; linhas = [{cel:[{txt,neg,cor,pill:[k,t],sub}], bg, cor, neg}]
    const tabela = (cols, linhas, cab) => {
        const pesos = cols.reduce((s, c) => s + c.w, 0), larg = cols.map(c => c.w / pesos * LARG);
        const desenhaCab = () => { fill(RC_AZUL); doc.rect(M, y, LARG, 16, 'F'); fonte(7, true); ink('#ffffff'); let x = M; cols.forEach((c, i) => { if (c.r) doc.text(c.t.toUpperCase(), x + larg[i] - 5, y + 11, { align: 'right' }); else doc.text(c.t.toUpperCase(), x + 5, y + 11); x += larg[i]; }); y += 16; };
        espaco(16 + 30); desenhaCab();
        linhas.forEach((ln, ri) => {
            const prep = ln.cel.map((c, i) => { const t = (c.pill && !c.txt) ? [] : quebra(c.txt || '', larg[i] - 10, 8.3, c.neg || ln.neg); const s = c.sub ? quebra(c.sub, larg[i] - 10, 7, false) : []; const o = c.obs ? quebra(c.obs, larg[i] - 10, 7, false) : []; return { t, s, o, h: 6 + t.length * 10.6 + s.length * 9 + o.length * 9 + (c.pill ? 16 : 0) }; });
            const alt = Math.max(...prep.map(p => p.h), 16);
            if (espaco(alt)) desenhaCab();
            const bg = ln.bg || (ri % 2 ? '#f8fafc' : '#ffffff'); fill(bg); doc.rect(M, y, LARG, alt, 'F'); draw('#e3e8ef'); doc.line(M, y + alt, M + LARG, y + alt);
            let x = M;
            ln.cel.forEach((c, i) => {
                const p = prep[i], cor = c.cor || ln.cor || '#222222'; let yy = y + 4;
                fonte(8.3, c.neg || ln.neg); ink(cor);
                p.t.forEach(l => { if (cols[i].r) doc.text(l, x + larg[i] - 5, yy + 8, { align: 'right' }); else doc.text(l, x + 5, yy + 8); yy += 10.6; });
                if (c.pill) { pill(c.pill[0], c.pill[1], x + 5, yy); yy += 16; }
                if (p.s.length) { fonte(7, false); ink('#6b778a'); p.s.forEach(l => { doc.text(l, x + 5, yy + 7); yy += 9; }); }
                if (p.o.length) { fonte(7, false); ink(RC_OBS); p.o.forEach(l => { doc.text(l, x + 5, yy + 7); yy += 9; }); }
                x += larg[i];
            });
            y += alt;
        });
        y += 6;
    };
    // caixa com barra lateral colorida (divergência / observação)
    const caixa = (cor, fundo, tag, titulo2, pillInfo, linhasTxt) => {
        const xi = M + 10, li = LARG - 12; const corpo = []; linhasTxt.forEach(t => quebra(t, li, 8.3).forEach(l => corpo.push(l)));
        const alt = 8 + 12 + corpo.length * 10.6 + 4; espaco(alt + 4);
        fill(fundo); doc.roundedRect(M + 2, y, LARG - 2, alt, 3, 3, 'F'); fill(cor); doc.rect(M, y, 4, alt, 'F');
        fonte(6.8, true); const tw = doc.getTextWidth(tag) + 8; fill(cor); doc.roundedRect(xi, y + 5, tw, 11, 2, 2, 'F'); ink('#ffffff'); doc.text(tag, xi + 4, y + 12.8);
        let xx = xi + tw + 6; if (titulo2) { fonte(8.5, true); ink('#222222'); doc.text(titulo2, xx, y + 13); xx += doc.getTextWidth(titulo2) + 6; }
        if (pillInfo) pill(pillInfo[0], pillInfo[1], xx, y + 4.5);
        fonte(8.3); ink('#222222'); corpo.forEach((l, i) => doc.text(l, xi, y + 26 + i * 10.6));
        y += alt + 4;
    };

    titulo('Resumo por fornecedor');
    tabela([{ t: 'Fornecedor ganhador', w: 34 }, { t: 'Recurso', w: 18 }, { t: 'Itens', w: 7, r: true }, { t: 'Valor total', w: 15, r: true }, { t: 'Entrega', w: 26 }],
        d.fornecedores.map(f => ({ cel: [{ txt: f.nome, neg: true }, { txt: f.recursos.map(r => f.recursos.length > 1 ? `${r.rotulo} (${r.n})` : r.rotulo).join(' · ') }, { txt: String(f.qtdItens) }, { txt: moedaRelCot(f.valorTotal) }, { txt: '', pill: [f.status.chave, f.status.rotulo], sub: detalheStatusRelCot(f) }] })));
    if (completo) {
        titulo('Detalhe por fornecedor');
        if (d.obsPedido) caixa(RC_OBS, '#f1f7ff', 'OBSERVAÇÃO', 'Do pedido (SmartCompras):', null, [d.obsPedido]);
        d.fornecedores.forEach((f, i) => {
            espaco(110); fill('#eef2f8'); draw('#cfd7e3'); doc.roundedRect(M, y, LARG, 30, 5, 5, 'FD');
            fonte(11, true); ink(RC_AZUL); doc.text(`${i + 1}. ${f.nome}`, M + 9, y + 13); fonte(7.5); ink('#6b778a'); doc.text('CNPJ ' + (typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(f.cnpj) : f.cnpj), M + 9, y + 24);
            pill(f.status.chave, f.status.rotulo, M + LARG - 9, y + 9, true); y += 36;
            const fatos = [['Recurso', f.recursos.map(r => f.recursos.length > 1 ? `${r.rotulo} (${r.n})` : r.rotulo).join(' · ')], ['Itens', String(f.qtdItens)], ['Valor total', moedaRelCot(f.valorTotal)]];
            let fx = M + 4; fatos.forEach(([a, b]) => { fonte(6.8); ink('#7a8698'); doc.text(a.toUpperCase(), fx, y + 7); fonte(9.5, true); ink('#222222'); doc.text(b, fx, y + 18); fx += Math.max(doc.getTextWidth(b), 40) + 22; }); y += 26;
            if (f.status.chave === 'parcial' && f.faltando.length) {
                const itensF = f.faltando.map(it => '• ' + it.nome + ' — ' + it.quantidade + ' un.'), corpo = []; itensF.forEach(t => quebra(t, LARG - 20, 8.5, true).forEach(l => corpo.push(l)));
                const alt = 8 + 11 + corpo.length * 10.8 + 4; espaco(alt + 4);
                fill('#fdecec'); draw(RC_VERM); doc.setLineWidth(1.2); doc.roundedRect(M, y, LARG, alt, 4, 4, 'FD'); doc.setLineWidth(0.6);
                fonte(8, true); ink('#9b1c1c'); doc.text(`ITENS NÃO ENTREGUES (${f.faltando.length})`, M + 9, y + 13); fonte(8.5, true); corpo.forEach((l, k) => doc.text(l, M + 9, y + 25 + k * 10.8)); y += alt + 5;
            }
            f.divergencias.forEach(v => caixa(RC_VERM, '#fff6f6', 'DIVERGÊNCIA', v.tipo, [chaveStatusDivRelCot(v.status), rotuloStatusDivRelCot(v.status)], [(v.nf ? 'NF ' + v.nf + ' — ' : '') + v.linhas.join(' ')]));
            if (!f.divergencias.length) { espaco(14); fonte(8.3); ink('#1b6e36'); doc.text('Nenhuma divergência registrada para este fornecedor.', M + 2, y + 9); y += 16; }
            tabela([{ t: 'Cód.', w: 9 }, { t: 'Item e especificação', w: 43 }, { t: 'Qtd', w: 8, r: true }, { t: 'Unit.', w: 9, r: true }, { t: 'Total', w: 12, r: true }, { t: 'Entrega', w: 19 }],
                f.itens.map(it => { const falta = ehFaltaRelCot(f, it), sit = falta ? 'Não entregue' : entregaItemRelCot(f, it);
                    return { bg: falta ? '#fdecec' : null, cor: falta ? '#9b1c1c' : (it.situacao === 'Cancelada' ? '#999999' : null), neg: falta,
                        cel: [{ txt: it.cod }, { txt: it.nome, sub: especItemRelCot(f, it), obs: it.original ? 'SmartCompras: ' + it.original : '' }, { txt: it.quantidade }, { txt: it.unitario }, { txt: it.total !== null ? moedaRelCot(it.total) : '—' }, { txt: (falta ? 'x ' : '') + sit, neg: falta, cor: falta ? '#9b1c1c' : (it.entregue ? '#1b6e36' : null) }] }; }));
            y += 6;
        });
    }
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) { doc.setPage(p); fonte(7.5); ink('#8a97a8'); doc.setDrawColor(225, 230, 238); doc.line(M, H - 24, W - M, H - 24); doc.text(`Cotação ${d.pedido} · Relatório ${completo ? 'completo' : 'básico'}`, M, H - 13); doc.text(`Página ${p} de ${n}`, W - M, H - 13, { align: 'right' }); }
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
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/45-exportar-cotacao.js'] = '2.23.2';
