// 47-resumo-pendencias.js — Resumo de pendências de entrega dos fornecedores, por pedido (2.24.0)
// Parte do script do app. Arquivo comum, carregado pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Para um ou vários pedidos, monta o texto no formato usado na auditoria:
//   PEDIDO 1748
//   (fornecedores sem pendência, um por linha)
//   PENDÊNCIAS:
//   FORNECEDOR - N.F. 123
//   o que falta / divergência / recurso a confirmar
// Só lê o que o app já calcula (dadosRelatorioCotacao, cotações por item). Nada é gravado.
// ===================================================================
let resumoPendPedidos = [], resumoPendTexto = '';

function pedidosDoTextoResumo(txt) { return [...new Set(String(txt || '').split(/[^0-9]+/).filter(x => x.length >= 3))]; }
const maiusculoResumo = s => String(s || '').toUpperCase();
const itemLinhaResumo = (nome, qtd, resto) => `${maiusculoResumo(nome)}${qtd !== undefined && qtd !== '' && qtd !== '—' ? ', quantidade ' + qtd : ''}, ${resto}`;

// { pedido, origem, limite, ok:[nomes], pend:[{ nome, nfs:[], linhas:[] }], cancelados:[nomes] } ou null
function dadosResumoPendenciasPedido(pedido) {
    const d = dadosRelatorioCotacao(pedido); if (!d) return null;
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)) || {};
    const r = { pedido: String(pedido), origem: d.origem || '', limite: d.dataLimite || '', ok: [], pend: [], cancelados: [] };
    d.fornecedores.forEach(f => {
        const nome = maiusculoResumo(f.nome), linhas = [], nfs = [];
        const chave = f.status.chave;
        if (chave === 'cancelada') { r.cancelados.push(nome); return; }
        // divergências em aberto/relatadas (as resolvidas e encerradas não entram)
        (f.divergencias || []).filter(x => x.status !== 'Resolvida' && x.status !== 'Encerrada').forEach(x => {
            if (x.nf) String(x.nf).split(',').map(s => s.trim()).filter(Boolean).forEach(n => { if (!nfs.includes(n)) nfs.push(n); });
            (x.linhas || []).forEach(l => { const t = String(l).trim(); if (t && !linhas.includes(t)) linhas.push(t); });
        });
        const jaCitado = nomeItem => linhas.some(l => maiusculoResumo(l).includes(maiusculoResumo(nomeItem)));
        // entrega: o que não chegou
        if (chave === 'pendente') {
            if (/ERP/i.test(f.status.detalhe || '')) linhas.push('NF lançada no ERP, itens e quantidades ainda não conferidos.');
            else linhas.push(`Nenhum item recebido ainda (${f.itens.length} item(ns) aguardando entrega).`);
        } else if (chave === 'parcial') {
            f.itens.filter(i => i.falta && !jaCitado(i.nome)).forEach(i => {
                linhas.push(i.situacao === 'Parcial' ? `${maiusculoResumo(i.nome)}: cotado ${i.quantidade}, chegou parcialmente.` : itemLinhaResumo(i.nome, i.quantidade, 'não foi faturado.'));
            });
        }
        // recurso: itens do fornecedor com menos cotações que o mínimo e sem recurso confirmado
        try {
            const produtos = (cot.itens || []).filter(it => normalizarCnpj(it.cnpjFornecedor) === normalizarCnpj(f.cnpj));
            const rc = resumoCotacoesDoFornecedor(cot.pedido, produtos);
            const abaixo = rc.abaixo.filter(x => { const it = produtos.find(p => (p.nomeOficial || p.descricao || p.codProduto) === x.nome); return !(it && (cot.recursosPorItem || {})[it.codProduto]); });
            if (abaixo.length) {
                const nomes = abaixo.map(x => maiusculoResumo(x.nome)).join('; ');
                const outros = rc.total - abaixo.length;
                linhas.push(`${nomes}: ${abaixo.length === 1 ? 'não atingiu' : 'não atingiram'} ${rc.minimo} cotações${outros > 0 ? ` (${abaixo.length === 1 ? 'os outros' : 'os demais'} ${outros} ${outros === 1 ? 'item atingiu' : 'itens atingiram'})` : ''}, confirmar recurso.`);
            }
        } catch (e) { /* sem dado de cotações: não afeta o resto */ }
        if (linhas.length) r.pend.push({ nome, nfs, linhas }); else r.ok.push(nome);
    });
    r.ok.sort(); r.pend.sort((a, b) => a.nome.localeCompare(b.nome));
    return r;
}

function textoResumoPendencias(pedidos) {
    const L = ['RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', ''], naoAchados = [];
    pedidos.forEach(p => {
        let r; try { r = dadosResumoPendenciasPedido(p); } catch (e) { console.error('Resumo de pendências', p, e); r = null; }
        if (!r) { naoAchados.push(p); return; }
        L.push(`PEDIDO ${r.pedido}`, '');
        if (r.ok.length) { r.ok.forEach(n => L.push(n)); L.push(''); }
        if (r.cancelados.length) { r.cancelados.forEach(n => L.push(n + ' (entrega cancelada)')); L.push(''); }
        if (r.pend.length) {
            L.push('PENDÊNCIAS:', '');
            r.pend.forEach(x => { L.push(x.nome + (x.nfs.length ? ' - N.F. ' + x.nfs.join(', ') : ':')); x.linhas.forEach(l => L.push(l)); L.push(''); });
        } else L.push('Nenhuma pendência de entrega.', '');
        L.push('');
    });
    if (naoAchados.length) L.push(`Pedido(s) não encontrado(s) em Cotações: ${naoAchados.join(', ')}.`, '');
    return L.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}
function htmlResumoPendencias(texto) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const corpo = texto.split('\n').map(l => /^(RESUMO DE|PEDIDO |PENDÊNCIAS:)/.test(l) ? `<p><b>${esc(l)}</b></p>` : l ? `<p>${esc(l)}</p>` : '<p>&nbsp;</p>').join('');
    return `<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}p{margin:0}</style></head><body>${corpo}</body></html>`;
}

// ---- tela (janela) de uso
function abrirResumoPendencias(pedidosIniciais) {
    const lista = Array.isArray(pedidosIniciais) ? pedidosIniciais : (pedidosIniciais ? [pedidosIniciais] : []);
    const campo = document.getElementById('resumo-pend-pedidos'); if (campo && lista.length) campo.value = lista.join(', ');
    const m = document.getElementById('resumo-pend-modal'); if (m) m.classList.add('active');
    gerarResumoPendencias();
}
function abrirResumoPendenciasSelecionadas() {
    const sel = typeof cotacoesSelecionadas !== 'undefined' ? [...cotacoesSelecionadas] : [];
    if (!sel.length) return toast('Selecione ao menos uma cotação.');
    abrirResumoPendencias(sel);
}
function gerarResumoPendencias() {
    const campo = document.getElementById('resumo-pend-pedidos'), area = document.getElementById('resumo-pend-texto'); if (!campo || !area) return;
    resumoPendPedidos = pedidosDoTextoResumo(campo.value);
    if (!resumoPendPedidos.length) { resumoPendTexto = ''; area.value = ''; return; }
    resumoPendTexto = textoResumoPendencias(resumoPendPedidos); area.value = resumoPendTexto;
}
async function copiarResumoPendencias() {
    gerarResumoPendencias(); if (!resumoPendTexto) return toast('Informe os números dos pedidos.');
    try { await navigator.clipboard.writeText(resumoPendTexto); toast('✓ Resumo copiado.'); }
    catch (e) { const a = document.getElementById('resumo-pend-texto'); if (a) { a.focus(); a.select(); } toast('Selecione e copie o texto.'); }
}
async function baixarResumoPendencias(formato) {
    gerarResumoPendencias(); if (!resumoPendTexto) return toast('Informe os números dos pedidos.');
    const base = 'Resumo-pendencias-' + resumoPendPedidos.slice(0, 4).join('-');
    if (formato === 'doc') await entregarArquivoRelCot(base + '.doc', new Blob(['﻿', htmlResumoPendencias(resumoPendTexto)], { type: 'application/msword' }));
    else await entregarArquivoRelCot(base + '.txt', new Blob([resumoPendTexto], { type: 'text/plain;charset=utf-8' }));
}
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/47-resumo-pendencias.js'] = '2.24.0';
