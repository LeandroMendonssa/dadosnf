// 23-conferencia-automatica.js — Conferência automática (2.3.0)
// Parte do script do app (v2.3.0). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.3.0: O APP APONTA O PROBLEMA SOZINHO ---
// ===================================================================
// 1) Adicionar: ao digitar uma NF que já existe no app (XML ou ERP) avisa na hora, em vez de deixar duplicar;
// 2) NF sem pedido: sugere o pedido pelos nomes dos itens (ou marcar como compra direta);
// 3) Itens fora do pedido: itens faturados que não estão na cotação do pedido ou foram ganhos por outra empresa.

// ---------- empresas do mesmo grupo (ex.: SOMA SP e SOMA MG) ----------
// Mesmo grupo = mesma raiz de CNPJ, CNPJs do mesmo fornecedor no SP Data, ou a primeira palavra do nome igual (ou uma
// começando a outra, com 4+ letras). Evita acusar "outro fornecedor" quando é a mesma empresa com outro CNPJ.
function primeiroTokenFornecedor(nome) { const t = tokensFornecedor(nome); return t.length ? t[0] : ''; }
function mesmoGrupoFornecedor(nomeA, cnpjA, nomeB, cnpjB) {
    if (cnpjA && cnpjB) {
        if (mesmaRaizCnpj(cnpjA, cnpjB) || normalizarCnpj(cnpjA) === normalizarCnpj(cnpjB)) return true;
        if (cnpjEmLista(cnpjsDaMesmaEntidadeFornecedor(cnpjA), cnpjB)) return true;
    }
    const a = primeiroTokenFornecedor(nomeA), b = primeiroTokenFornecedor(nomeB);
    const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
    return curto.length >= 4 && longo.startsWith(curto);
}

// ---------- 3) itens fora do pedido ----------
function itensForaDoPedido(pedido) {
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido));
    if (!cot) return [];
    const porCod = new Map();
    (cot.itens || []).forEach(i => { const k = String(i.codProduto); if (!porCod.has(k)) porCod.set(k, []); porCod.get(k).push(i); });
    const nomeDe = i => { const f = (cot.fornecedores || []).find(f => normalizarCnpj(f.cnpj) === normalizarCnpj(i.cnpjFornecedor)); return f ? nomeExibicaoFornecedor(f.razaoSocial, f.cnpj) : (i.cnpjFornecedor || ''); };
    const achados = [], vistos = new Set();
    const avaliar = (nfId, numero, nomeForn, cnpjForn, itens) => itens.forEach(it => {
        if (!it.cod) return;
        const doCod = porCod.get(String(it.cod));
        let tipo = null, ganhador = '';
        if (!doCod) tipo = 'fora_cotacao';
        else if (!doCod.some(i => mesmoGrupoFornecedor(nomeForn, cnpjForn, nomeDe(i), i.cnpjFornecedor))) { tipo = 'outro_ganhador'; ganhador = [...new Set(doCod.map(nomeDe))].join(' / '); }
        if (!tipo) return;
        const k = `${numero}|${it.cod}|${tipo}`; if (vistos.has(k)) return; vistos.add(k);
        achados.push({ tipo, nome: it.nome, nf: numero, fornecedor: nomeForn, cnpj: cnpjForn, nfId, ganhador });
    });
    // NFs com XML no app
    listaNfsProcessadas.filter(n => String(n.pedido) === String(pedido) || (n.pedidos || []).map(String).includes(String(pedido)))
        .forEach(nf => avaliar(nf.id, nf.nf, nf.fornecedor || '', nf.cnpjFornecedor, (nf.itens || []).filter(i => !i.semCotacao).map(i => ({ cod: i.codigoSmartCompras, nome: i.xProd }))));
    // entradas do ERP sem NF/XML pareada (2.3.1: levam o id do ERP, e o botão "Abrir NF" abre o Editor da NF dessa entrada)
    const pareadas = mapaPedidoErpPelaNf();
    listaEntradasErp.filter(e => pedidoDoErpConfirmado(e) === String(pedido) && !pareadas.has(e.id))
        .forEach(e => avaliar(e.id, e.nf, e.fornecedorNomeRelatorio || '', e.cnpjFornecedor, (e.itens || []).map(i => ({ cod: i.codigoSmartComprasRelacionado, nome: i.nome }))));
    return achados;
}
function htmlItensForaDoPedido(pedido) {
    const lista = itensForaDoPedido(pedido);
    if (!lista.length) return '';
    const linhas = lista.map(x => `<div class="nfe-alerta-txt" style="margin-top:10px"><strong>${escRel(x.nome)}</strong> — ${x.tipo === 'fora_cotacao' ? 'não está na cotação deste pedido' : 'na cotação foi ganho por ' + escRel(x.ganhador)}
        <div class="nfe-dica">NF ${escRel(x.nf)} · ${escRel(x.fornecedor)}${x.nfId ? ` <button type="button" class="action-chip edit-chip" style="height:28px;padding:0 12px;margin-left:6px" onclick="abrirEditorNf('${x.nfId}')">Abrir NF</button>` : ''}</div></div>`).join('');
    return `<div class="card nfe-alerta" style="margin-bottom:12px"><div class="nfe-alerta-tit">⚠ ${lista.length} item(ns) fora do pedido</div>${linhas}
        <div class="nfe-dica" style="margin-top:10px">Confira se faturaram no pedido certo. Se a NF for de outro pedido, mova-a no Editor da NF.</div></div>`;
}

// ---------- 2) NF sem pedido ----------
function nfSemPedidoPendente(nf) {
    return !!nf && !nf.pedido && !(nf.pedidos || []).length && !nf.semCotacaoSmartCompras && !(nf.itens || []).some(i => i.semCotacao);
}
// Pedido provável pelos NOMES dos itens do XML, só entre os itens que o fornecedor ganhou em cada cotação.
// Medido no histórico (56 NFs com pedido): 0 erros; sem cobertura de pelo menos metade dos itens, não sugere.
function sugerirPedidoPorNomes(nf) {
    const total = (nf.itens || []).length; if (!total) return [];
    const cn = nf.cnpjFornecedor, r = [];
    listaCotacoes.forEach(c => {
        const base = (c.itens || []).filter(i => mesmaRaizCnpj(cn, i.cnpjFornecedor) || normalizarCnpj(i.cnpjFornecedor) === normalizarCnpj(cn));
        if (!base.length) return;
        let n = 0; nf.itens.forEach(it => { if (sugestoesItemCotacao(it.xProd, base).itens.length) n++; });
        if (n > 0) r.push({ pedido: c.pedido, itens: n });
    });
    r.sort((a, b) => b.itens - a.itens);
    if (!r.length || r[0].itens / total < 0.5) return [];
    return r.filter(x => x.itens === r[0].itens).map(x => ({ ...x, total }));
}
function marcarNfCompraDireta(nfId) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId); if (!nf) return;
    showConfirmModal({
        title: 'Marcar como compra direta',
        message: `NF ${nf.nf} — ${nf.fornecedor || ''}\nEla passa a ser tratada como compra sem cotação do SmartCompras e deixa de aparecer como "sem pedido".`,
        confirmText: 'Marcar', confirmClass: 'warning',
        onConfirm: async () => {
            try { await nfsProcessadasCollection.doc(nfId).update({ semCotacaoSmartCompras: true }); toast('✓ NF marcada como compra direta.'); }
            catch (e) { console.error('Erro ao marcar compra direta:', e); toast('✕ Erro ao marcar a NF.'); }
        }
    });
}
function htmlNfSemPedido(nf) {
    if (!nfSemPedidoPendente(nf)) return '';
    const sug = sugerirPedidoPorNomes(nf);
    const botoes = sug.map(s => `<button type="button" class="central-status-toggle" onclick="moverNfParaPedido('${nf.id}', '${escRel(s.pedido)}')">Vincular ao pedido ${escRel(s.pedido)} (${s.itens} de ${s.total} itens combinam)</button>`).join(' ');
    return `<div class="card nfe-alerta">
        <div class="nfe-alerta-tit">⚠ NF sem pedido</div>
        <div class="nfe-alerta-txt">${sug.length ? 'Pelos nomes dos itens, esta NF parece ser de um destes pedidos. Confira antes de vincular.' : 'Nenhuma cotação deste fornecedor combina com os itens desta NF. Se foi uma compra sem cotação, marque como compra direta; se tem pedido, use "Mover esta NF para outro pedido" abaixo.'}</div>
        <div class="nfe-acoes">${botoes} <button type="button" class="central-status-toggle" onclick="marcarNfCompraDireta('${nf.id}')">Marcar como compra direta</button></div>
    </div>`;
}

// ---------- 1) Adicionar: NF que já existe no app ----------
function htmlNfExistenteAdicionar() {
    if (!DOM.nf) return '';
    const num = normNfNumero(DOM.nf.value);
    if (!num || num.length < 2) return '';
    const forn = DOM.forn ? DOM.forn.value.trim() : '';
    const descNota = forn ? descFornecedor(null, forn) : null;
    const compat = (cnpj, nome, valor) => !descNota || forcaMesmoFornecedor(descNota, descFornecedor(cnpj, nome), '', valor) > 0;
    const itens = [];
    listaNfsProcessadas.forEach(nf => {
        if (normNfNumero(nf.nf) !== num || !compat(nf.cnpjFornecedor, nf.fornecedor, nf.valorTotal)) return;
        itens.push({ txt: `${tituloFornNf(nf.fornecedor, nf.cnpjFornecedor, nf.nf)} · XML processado${nf.pedido ? ' (pedido ' + nf.pedido + ')' : ''}`, acao: `abrirEditorNf('${nf.id}')`, rotulo: 'Abrir NF' });
    });
    const pareadas = mapaPedidoErpPelaNf();
    listaEntradasErp.forEach(e => {
        if (normNfNumero(e.nf) !== num || pareadas.has(e.id) || !compat(e.cnpjFornecedor, e.fornecedorNomeRelatorio, e.valor)) return;
        itens.push({ txt: `${tituloFornNf(e.fornecedorNomeRelatorio, e.cnpjFornecedor, e.nf)} · só no relatório do ERP`, acao: 'abrirControleNfs()', rotulo: 'Ver no Controle de NFs' });
    });
    if (!itens.length) return '';
    return `<div class="aviso-nf"><div class="aviso-nf-tit">Esta NF já existe no app</div>
        ${itens.slice(0, 3).map(i => `<div class="aviso-nf-linha">${escRel(i.txt)} <button type="button" class="action-chip edit-chip" style="height:28px;padding:0 12px" onclick="${i.acao}">${i.rotulo}</button></div>`).join('')}
        <div class="aviso-nf-dica">Se for a mesma nota, envie pelo Controle de NFs ("Enviar para a relação"): os dados já estão lá. Se salvar aqui, a nota será ligada a essa NF automaticamente.</div></div>`;
}
if (DOM.forn) DOM.forn.addEventListener('input', () => { if (typeof atualizarSugestoesNf === 'function') atualizarSugestoesNf(); });
