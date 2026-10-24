// 36-visao-nf.js — Visão única da NF (2.12.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// UMA NF = UM OBJETO. Os dados continuam onde sempre estiveram (nfsProcessadas, entradasErp, cotações, anotações, associações),
// mas as telas deixam de cada uma refazer a conta do seu jeito: pedem aqui, e a resposta é a mesma em todo o app.
// Construída em cima do pareamento que o Controle de NFs já fazia (XML + ERP da mesma NF numa linha) e das regras que já
// existiam (recursosAtuaisDaNf, destinoDaNfSalva, pedidoDoErpConfirmado, divergenciasRel, totalErpComFrete...). Só leitura.
//
// Cada visão tem:
//   chave, numeroNf, serie, fornecedor, cnpj, dataISO, situacao (do Controle), nf (XML), erp (ERP), fontes {xml, erp}
//   pedido (confirmado), pedidos (todos), pedidoSugerido, pedidoSt ('confirmado'|'sugerido'|'compra_direta'|'sem_pedido'|'direta'), cot
//   chegou (a NF existe para um pedido), destino, recursos [..], recursoOrigem ('manual'|'cotacao'|null)
//   totais { produtos, frete, nota }, itens [{ fonte, nome, qtd, valorUnit, total, codigoSmartCompras, codigoSpData, cProd, recurso, semCotacao }]
//   divergencias (pendentes do pedido, mesma lista do Relatórios), pendencias [{ id, nivel, texto }]
// ===================================================================
let _visoesNfMemo = null;
function visoesNf() {
    if (_visoesNfMemo) return _visoesNfMemo; // vale só dentro da mesma execução (zera já no fim dela): dois pedidos seguidos não refazem tudo
    Promise.resolve().then(() => { _visoesNfMemo = null; });

    // divergências pendentes: a MESMA lista (e a mesma regra de status) de Relatórios → Divergências, sem os filtros da tela
    const filtrosTela = relatoriosFiltros;
    relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' };
    let pendDiv = []; try { pendDiv = divergenciasRel().filter(x => x.status === 'pendente'); } finally { relatoriosFiltros = filtrosTela; }

    const lista = montarControleNfs().filter(it => it.tipo === 'nf').map(it => {
        const nf = it.nf || null, erp = it.erp || null;
        const pedido = it.pedido ? String(it.pedido) : null;
        const pedidos = [...new Set([pedido, ...((nf && nf.pedidos) || []).map(String)].filter(Boolean))];
        const cot = pedido ? listaCotacoes.find(c => String(c.pedido) === pedido) : null;
        const vinc = (erp && erp.vinculo) || {};
        const pedidoSugerido = !pedido && vinc.status === 'sugerido' && vinc.pedido ? String(vinc.pedido) : null;
        const compraDireta = !!((erp && erp.semPedido) || (nf && (nf.semCotacaoSmartCompras || (nf.itens || []).some(i => i.semCotacao))));
        let pedidoSt = pedido ? 'confirmado' : (it.situacao === 'direta' ? 'direta' : (pedidoSugerido ? 'sugerido' : (compraDireta ? 'compra_direta' : 'sem_pedido')));

        // itens: do XML quando existe, senão do ERP (cada um com o produto da cotação e o recurso que o app já conhece)
        const recursoDe = (cod, semCot, rec) => semCot ? (rec || '') : ((cot && cod && (cot.recursosPorItem || {})[cod]) || '');
        const itens = nf && (nf.itens || []).length
            ? nf.itens.map(i => ({ fonte: 'xml', nome: i.xProd, qtd: i.quantidade, valorUnit: i.valorUnitario, total: null, codigoSmartCompras: i.codigoSmartCompras || null, codigoSpData: i.codigoSpData || null, cProd: i.cProd, semCotacao: !!(i.semCotacao || nf.semCotacaoSmartCompras), recurso: recursoDe(i.codigoSmartCompras, i.semCotacao || nf.semCotacaoSmartCompras, i.recurso) }))
            : ((erp && erp.itens) || []).map(i => { const cod = i.codigoSmartComprasRelacionado || codigoProdutoAtualDoItemErp(i) || null; return { fonte: 'erp', nome: i.nome, qtd: i.quantidade, valorUnit: i.valorUnitario, total: i.valorTotal != null ? i.valorTotal : null, codigoSmartCompras: cod, codigoSpData: i.codigoSpData || null, cProd: null, semCotacao: false, recurso: (erp && erp.recursoManual) || recursoDe(cod, false, '') }; });
        const recursos = [...new Set(itens.map(i => i.recurso).filter(Boolean))];
        const recursoOrigem = !recursos.length ? null : ((erp && erp.recursoManual) || itens.some(i => i.semCotacao && i.recurso) ? 'manual' : 'cotacao');

        const fin = (erp && erp.financeiro) || {};
        const produtos = fin.totalNota != null ? Number(fin.totalNota) : itens.reduce((s, i) => s + (i.total != null ? i.total : (Number(i.qtd) || 0) * (Number(i.valorUnit) || 0)), 0);
        const nota = (erp ? totalErpComFrete(erp) : null) || (nf ? numeroFlexivel(nf.valorTotal) : null) || numeroFlexivel(it.valorTxt);
        const totais = { produtos, frete: Number(fin.frete) || 0, nota };

        const divergencias = pedido ? pendDiv.filter(d => String(d.pedido) === pedido && (!d.fornecedorCnpj || !it.cnpj || mesmoCnpj(d.fornecedorCnpj, it.cnpj))) : [];

        // pendências desta NF (as mesmas que o painel de atenção lista, agora calculadas uma vez só)
        const pendencias = [];
        const diasDaData = it.dataISO ? diasDesdeISO(it.dataISO) : null;
        if (erp && erp.statusFluxo === 'pre_selecao' && diasDaData != null && diasDaData > 7) pendencias.push({ id: 'decisao-parada', nivel: 'media', texto: `lançada em ${erp.data} (${diasDaData} dia(s)): falta decidir relação, financeiro ou "não vai ao financeiro"` });
        if (nf && nfSemPedidoPendente(nf)) pendencias.push({ id: 'sem-pedido', nivel: 'media', texto: 'sem pedido e sem marca de compra direta' });
        if (pedidoSt === 'sugerido') pendencias.push({ id: 'pedido-sugerido', nivel: 'media', texto: `pedido ${pedidoSugerido} sugerido, falta confirmar` });
        if (nf) {
            const semProd = nf.semCotacaoSmartCompras ? 0 : (nf.itens || []).filter(i => !i.semCotacao && !i.codigoSmartCompras).length; // compra direta marcada: não há produto de cotação para associar
            if (semProd) pendencias.push({ id: 'sem-produto', nivel: 'baixa', texto: `${semProd} item(ns) sem associação` });
            const semRec = itens.filter(i => !i.recurso).length;
            if (semRec) pendencias.push({ id: 'sem-recurso', nivel: 'baixa', texto: `${semRec} de ${itens.length} item(ns) sem recurso` });
        }
        if (divergencias.length) pendencias.push({ id: 'divergencias', nivel: 'media', texto: `${divergencias.length} divergência(s) pendente(s) no pedido ${pedido}` });

        return { chave: it.chave, numeroNf: it.numeroNf, serie: it.serie, fornecedor: it.nomeFornecedor, cnpj: it.cnpj, dataISO: it.dataISO, situacao: it.situacao,
            nf, erp, fontes: { xml: !!nf, erp: !!erp }, id: (nf && nf.id) || (erp && erp.id) || null,
            pedido, pedidos, pedidoSugerido, pedidoSt, cot, chegou: !!pedido, compraDireta,
            destino: (nf ? destinoDaNfSalva(nf) : null) || (cot && cot.origem) || null, recursos, recursoOrigem, totais, itens, divergencias, pendencias, controle: it };
    });
    _visoesNfMemo = lista;
    return lista;
}
function visaoNfPorId(id) { return visoesNf().find(v => v.id === id || (v.nf && v.nf.id === id) || (v.erp && v.erp.id === id)) || null; }
// Pendências de todas as NFs com um id (ex.: 'sem-pedido'), prontas para listar
function pendenciasNf(idPendencia) { return visoesNf().filter(v => v.pendencias.some(p => p.id === idPendencia)).map(v => ({ v, p: v.pendencias.find(p => p.id === idPendencia) })); }
