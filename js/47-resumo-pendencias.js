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

// { pedido, ok:[nomes], pend:[{ nome, linhas:[] }], cancelados:[nomes] } ou null
// Regras: só entra em PENDÊNCIAS o produto que o fornecedor NÃO faturou (quando já faturou outros itens do pedido) e que ainda não foi
// sinalizado/relatado. Fornecedor que ainda não entregou nada, ou que está completo, aparece só na lista de nomes (apelido do app).
function dadosResumoPendenciasPedido(pedido) {
    const d = dadosRelatorioCotacao(pedido); if (!d) return null;
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)) || {};
    const comp = compararFontesPedido(cot.pedido);
    const r = { pedido: String(pedido), ok: [], pend: [], cancelados: [] };
    d.fornecedores.forEach(f => {
        const nome = maiusculoResumo(f.nome);
        if (f.status.chave === 'cancelada') { r.cancelados.push(nome); return; }
        const linhas = [];
        comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === normalizarCnpj(f.cnpj) && x.estado === 'detectada' && x.soNaoChegou).forEach(x => {
            const dv = (x.divergencias || []).find(v => v.tipo === 'nao_faturado') || {};
            const it = (cot.itens || []).find(i => i.codProduto === x.codProduto) || {};
            const qtd = dv.quantidadeCotada !== undefined && dv.quantidadeCotada !== '' ? dv.quantidadeCotada : it.quantidade;
            linhas.push(itemLinhaResumo(x.nome || it.nomeOficial || it.descricao || x.codProduto, qtd, 'não foi faturado.'));
        });
        if (linhas.length) r.pend.push({ nome, linhas }); else r.ok.push(nome);
    });
    r.ok.sort((a, b) => a.localeCompare(b)); r.pend.sort((a, b) => a.nome.localeCompare(b.nome));
    return r;
}

function textoResumoPendencias(pedidos) {
    const L = ['RESUMO DE PENDÊNCIAS DE ENTREGA DOS FORNECEDORES', 'DATA: ' + new Date().toLocaleDateString('pt-BR'), ''], naoAchados = [];
    pedidos.forEach(p => {
        let r; try { r = dadosResumoPendenciasPedido(p); } catch (e) { console.error('Resumo de pendências', p, e); r = null; }
        if (!r) { naoAchados.push(p); return; }
        L.push(`PEDIDO ${r.pedido}`, '');
        if (r.ok.length) { r.ok.forEach(n => L.push(n)); L.push(''); }
        if (r.cancelados.length) { r.cancelados.forEach(n => L.push(n + ' (entrega cancelada)')); L.push(''); }
        L.push('PENDÊNCIAS:', '');
        if (r.pend.length) r.pend.forEach(x => { L.push(x.nome + ':'); x.linhas.forEach(l => L.push(l)); L.push(''); });
        else L.push('Nenhuma.', '');
        L.push('');
    });
    if (naoAchados.length) L.push(`Pedido(s) não encontrado(s) em Cotações: ${naoAchados.join(', ')}.`, '');
    return L.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}
function htmlResumoPendencias(texto) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const corpo = texto.split('\n').map(l => /^(RESUMO DE|DATA:|PEDIDO |PENDÊNCIAS:)/.test(l) ? `<p><b>${esc(l)}</b></p>` : l ? `<p>${esc(l)}</p>` : '<p>&nbsp;</p>').join('');
    return `<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}p{margin:0}</style></head><body>${corpo}</body></html>`;
}

// ---- tela (janela) de uso
function abrirResumoPendencias(pedidosIniciais) {
    try { if (typeof assinarDados === 'function') assinarDados('fornecedoresSpData'); } catch (e) { }   // apelidos dos fornecedores
    const lista = Array.isArray(pedidosIniciais) ? pedidosIniciais : (pedidosIniciais ? [pedidosIniciais] : []);
    const campo = document.getElementById('resumo-pend-pedidos'); if (campo && lista.length) campo.value = lista.join(', ');
    const m = document.getElementById('resumo-pend-modal'); if (m) m.classList.add('active');
    gerarResumoPendencias(); setTimeout(() => { const m2 = document.getElementById('resumo-pend-modal'); if (m2 && m2.classList.contains('active')) gerarResumoPendencias(); }, 1500);   // refaz quando o cadastro de fornecedores terminar de carregar
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
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/47-resumo-pendencias.js'] = '2.24.1';
