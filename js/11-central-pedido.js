// 11-central-pedido.js — Central do pedido: comparação de 3 fontes, status de entrega, aptidão, auditoria retroativa
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Fase 30 — reaproveitar o código de fornecedor já associado ao produto
// ===================================================================
// Busca REVERSA (só leitura, nada é gravado nem decidido sozinho): dado o
// produto SP Data do item (98), acha os códigos de fornecedor (123, 777...)
// que já foram associados a ele no histórico do app, pra o usuário poder
// mandar na saída um código que o fornecedor já usou em vez do código novo
// (645). O código SP Data é só a REFERÊNCIA da busca — nunca vai pro cProd.
// GTIN/cEAN não participa. Só códigos VIGENTES são candidatos; os
// substituídos aparecem apenas como auditoria.

// SP Data de referência: o escolhido manualmente (spDataReferenciaXml) ou o
// SP Data atual do item (cotação ou compra direta, via statusItemXml).
function spDataAlvoReaproveitamentoXml(item) {
    if (!item) return null;
    if (item.spDataReferenciaXml) return item.spDataReferenciaXml;
    const st = statusItemXml(item);
    return (st && st.produtoSpData) ? st.produtoSpData.codigo : null;
}

// Data em que um vínculo passou a valer: a ÚLTIMA entrada do historico[] com
// aquele valor. Sem entrada (registro antigo sem historico, ou entrada
// apagada pelo "Excluir do histórico") cai na data da raiz — que é regravada
// a cada confirmação e pode ser posterior à real — e isso fica marcado como
// aproximada, nunca em silêncio.
function dataVigenciaEntradaXml(historico, campo, valor, dataRaiz) {
    const datas = (historico || []).filter(h => h && h[campo] === valor && h.confirmadoEm).map(h => h.confirmadoEm).sort();
    if (datas.length) return { data: datas[datas.length - 1], aproximada: false };
    return { data: dataRaiz || null, aproximada: true };
}

// Compra direta guarda o vínculo em associacoesSpData com a chave
// "DIRETO::cnpj::cProd" (sem campo codigoFornecedor, e "/" vira "_"). Só
// devolve o código quando dá pra recuperá-lo com segurança: sem "_" na chave
// ele é exato; com "_" só se as NFs processadas deste app trouxerem UM único
// código original que gere exatamente essa chave. Senão, null (não sugere).
function codigoDeChaveDiretaXml(assocDireta) {
    const resto = String(assocDireta.codigoSmartCompras || '').slice('DIRETO::'.length);
    const sep = resto.indexOf('::');
    if (sep < 0) return null;
    const cnpjChave = resto.slice(0, sep), cprodChave = resto.slice(sep + 2);
    if (!cprodChave) return null;
    if (!cprodChave.includes('_')) return { cnpj: cnpjChave, codigo: cprodChave };
    const achados = new Set();
    listaNfsProcessadas.forEach(nf => {
        if (!mesmoCnpj(nf.cnpjFornecedor, cnpjChave)) return;
        (nf.itens || []).forEach(it => {
            if (it.cProd && chaveAssociacaoFornecedor(cnpjChave, it.cProd) === resto) achados.add(it.cProd);
        });
    });
    return achados.size === 1 ? { cnpj: cnpjChave, codigo: [...achados][0] } : null;
}

function buscarCodigosFornecedorPorSpData(cnpjEmit, cProdAtual, spDataAlvo) {
    const resultado = { spDataAlvo, produtoNome: null, vigentes: [], substituidos: [], ordemConfiavel: false, motivoIncerteza: null };
    if (!cnpjEmit || !spDataAlvo) return resultado;
    const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpjEmit);
    const produto = listaProdutosSpData.find(p => p.codigo === spDataAlvo);
    resultado.produtoNome = produto ? produto.nome : null;
    const ehDireta = a => String(a.codigoSmartCompras || '').startsWith('DIRETO::');
    const scVigentes = new Set(listaAssociacoesSpData.filter(a => !ehDireta(a) && a.spDataCodigo === spDataAlvo).map(a => a.codigoSmartCompras));
    const scJaLevaram = new Set(listaAssociacoesSpData.filter(a => !ehDireta(a) && (a.spDataCodigo === spDataAlvo || (a.historico || []).some(h => h.spDataCodigo === spDataAlvo))).map(a => a.codigoSmartCompras));
    const vigentesPorCodigo = {}, substituidosPorCodigo = {};
    const maisAntigo = (a, b) => (a && b) ? (a <= b ? a : b) : (a || b);
    const maisRecente = (a, b) => (a && b) ? (a >= b ? a : b) : (a || b);

    function registrarVigente(codigo, cnpj, fonte, desde, aproximada, codigoSmartCompras) {
        const atual = vigentesPorCodigo[codigo];
        if (!atual) { vigentesPorCodigo[codigo] = { codigoFornecedor: codigo, cnpjs: [cnpj], fontes: [fonte], codigoSmartCompras: codigoSmartCompras || null, desde, aproximada }; return; }
        if (!atual.cnpjs.includes(cnpj)) atual.cnpjs.push(cnpj);
        if (!atual.fontes.includes(fonte)) atual.fontes.push(fonte);
        // Mesmo código em mais de um CNPJ/fonte: vale o vínculo mais antigo.
        if (desde && (!atual.desde || desde < atual.desde)) { atual.desde = desde; atual.aproximada = aproximada; }
    }
    function registrarSubstituido(codigo, ligadoEm) {
        const atual = substituidosPorCodigo[codigo];
        if (!atual) substituidosPorCodigo[codigo] = { codigoFornecedor: codigo, ligadoEm: ligadoEm || null };
        else atual.ligadoEm = maisAntigo(atual.ligadoEm, ligadoEm);
    }

    // 1) Via cotação: fornecedor -> SmartCompras -> SP Data (as duas pontas vigentes).
    Object.values(bancoAssociacoesFornecedor).forEach(doc => {
        if (!doc || !doc.codigoFornecedor || doc.codigoFornecedor === cProdAtual) return;
        if (!cnpjEmLista(entidade, doc.cnpjFornecedor)) return;
        if (scVigentes.has(doc.codigoSmartCompras)) {
            const assocSp = listaAssociacoesSpData.find(a => a.codigoSmartCompras === doc.codigoSmartCompras);
            const dF = dataVigenciaEntradaXml(doc.historico, 'codigoSmartCompras', doc.codigoSmartCompras, doc.confirmadoEm);
            const dS = dataVigenciaEntradaXml(assocSp ? assocSp.historico : [], 'spDataCodigo', spDataAlvo, assocSp ? assocSp.confirmadoEm : null);
            registrarVigente(doc.codigoFornecedor, doc.cnpjFornecedor, 'cotacao', maisRecente(dF.data, dS.data), dF.aproximada || dS.aproximada, doc.codigoSmartCompras);
        } else {
            const entradas = (doc.historico || []).filter(h => scJaLevaram.has(h.codigoSmartCompras));
            if (scJaLevaram.has(doc.codigoSmartCompras) || entradas.length) {
                const datas = entradas.map(h => h.confirmadoEm).filter(Boolean).sort();
                registrarSubstituido(doc.codigoFornecedor, datas[0] || null);
            }
        }
    });

    // 2) Via compra direta: SmartCompras "DIRETO::cnpj::cProd" -> SP Data.
    listaAssociacoesSpData.filter(ehDireta).forEach(a => {
        const vigenteAgora = a.spDataCodigo === spDataAlvo;
        const jaLevou = vigenteAgora || (a.historico || []).some(h => h.spDataCodigo === spDataAlvo);
        if (!jaLevou) return;
        const rec = codigoDeChaveDiretaXml(a);
        if (!rec || rec.codigo === cProdAtual || !cnpjEmLista(entidade, rec.cnpj)) return;
        if (vigenteAgora) {
            const d = dataVigenciaEntradaXml(a.historico, 'spDataCodigo', spDataAlvo, a.confirmadoEm);
            registrarVigente(rec.codigo, rec.cnpj, 'direta', d.data, d.aproximada, null);
        } else {
            const datas = (a.historico || []).filter(h => h.spDataCodigo === spDataAlvo && h.confirmadoEm).map(h => h.confirmadoEm).sort();
            registrarSubstituido(rec.codigo, datas[0] || null);
        }
    });

    const vigentes = Object.values(vigentesPorCodigo);
    // Vigente em qualquer lugar vence: não aparece também como substituído.
    const substituidos = Object.values(substituidosPorCodigo).filter(c => !vigentesPorCodigo[c.codigoFornecedor]);

    // Só informativo: NFs processadas neste app com esse código (e se ele já
    // saiu com outro código na saída — campo cProdSaida, só nas NFs novas).
    vigentes.forEach(c => {
        const nfs = new Set(), saidas = new Set();
        listaNfsProcessadas.forEach(nf => {
            if (!cnpjEmLista(entidade, nf.cnpjFornecedor)) return;
            (nf.itens || []).forEach(it => {
                if (it.cProd !== c.codigoFornecedor) return;
                nfs.add(`${nf.nf}/${nf.serie || ''}`);
                if (it.cProdSaida && it.cProdSaida !== it.cProd) saidas.add(it.cProdSaida);
            });
        });
        c.nfsProcessadas = nfs.size;
        c.saiuComo = [...saidas];
    });

    // Mais antigo primeiro; sem data por último; desempate estável pelo código.
    vigentes.sort((a, b) => {
        if (a.desde && b.desde && a.desde !== b.desde) return a.desde < b.desde ? -1 : 1;
        if (a.desde && !b.desde) return -1;
        if (!a.desde && b.desde) return 1;
        return String(a.codigoFornecedor).localeCompare(String(b.codigoFornecedor));
    });
    substituidos.sort((a, b) => String(a.codigoFornecedor).localeCompare(String(b.codigoFornecedor)));

    // "Sugestão principal" só quando a ordem é confiável: uma data aproximada
    // é sempre >= à real, então o candidato dela poderia ser o mais antigo de
    // verdade; e datas idênticas não definem um "mais antigo".
    const algumaAproximada = vigentes.some(c => c.aproximada || !c.desde);
    const empate = vigentes.length > 1 && vigentes[0].desde === vigentes[1].desde;
    resultado.vigentes = vigentes;
    resultado.substituidos = substituidos;
    resultado.ordemConfiavel = vigentes.length > 0 && !algumaAproximada && !empate;
    resultado.motivoIncerteza = (vigentes.length > 1 && !resultado.ordemConfiavel) ? (algumaAproximada ? 'aproximada' : 'empate') : null;
    return resultado;
}

// Bloco do item: "Código de fornecedor já associado a este produto". Não
// aparece quando não há nada pra mostrar. Nunca escolhe sozinho.
function renderReaproveitamentoCodigoXml(item, idx) {
    if (!nfeInfoAtual) return '';
    const alvo = spDataAlvoReaproveitamentoXml(item);
    if (!alvo) return '';
    const r = buscarCodigosFornecedorPorSpData(nfeInfoAtual.cnpjEmit, item.cProd, alvo);
    if (!r.vigentes.length && !r.substituidos.length) return '';

    const usandoReuso = item.decisaoTomada === 'aplicado_codigo_fornecedor';
    const escolhidoForaDaLista = usandoReuso && !r.vigentes.some(c => c.codigoFornecedor === item.cProdNovo);
    const chaveSubst = 'reuso::' + idx;
    const substAberto = historicoAssociacaoAbertoXml.has(chaveSubst);

    const linhas = r.vigentes.map((c, i) => {
        const usando = usandoReuso && item.cProdNovo === c.codigoFornecedor;
        const foraDoCnpj = !c.cnpjs.some(x => mesmoCnpj(x, nfeInfoAtual.cnpjEmit));
        const detalhes = [
            c.desde ? `vigente desde ${formatarDataCompletaBR(c.desde)}${c.aproximada ? ' (data aproximada)' : ''}` : 'vigente (data desconhecida)',
            c.fontes.includes('direta') && !c.fontes.includes('cotacao') ? 'compra direta' : '',
            c.nfsProcessadas ? `${c.nfsProcessadas} NF(s) processada(s) neste app` : '',
            c.saiuComo.length ? `já saiu como ${c.saiuComo.map(escRel).join(', ')}` : '',
            foraDoCnpj ? `CNPJ ${c.cnpjs.map(escRel).join(', ')} da mesma entidade` : ''
        ].filter(Boolean).join(' · ');
        return `<div class="xml-item-linha" style="margin-top:6px;">
            <div class="xml-item-topo">
                <div>
                    <div class="xml-produto-nome">${escRel(c.codigoFornecedor)}</div>
                    <div class="xml-item-meta">${detalhes}</div>
                </div>
                ${(i === 0 && r.ordemConfiavel) ? '<span class="xml-item-badge pronto">sugestão principal</span>' : ''}
            </div>
            <div class="xml-item-acao">
                <button type="button" class="central-status-toggle" onclick="usarCodigoFornecedorReaproveitadoXml(${idx}, ${i})">${usando ? '✓ Usando' : 'Usar'} ${escRel(c.codigoFornecedor)} na saída</button>
            </div>
        </div>`;
    }).join('');

    const avisoOrdem = r.motivoIncerteza
        ? `<div class="nota-detalhes" style="margin-top:4px;">${r.motivoIncerteza === 'aproximada' ? 'Há datas aproximadas' : 'Há datas iguais'}: não dá pra apontar o mais antigo com segurança. Escolha manualmente.</div>` : '';
    const avisoForaDaLista = escolhidoForaDaLista
        ? `<div class="nota-detalhes" style="margin-top:4px;color:var(--danger);">O código escolhido (${escRel(item.cProdNovo)}) não está mais entre os vigentes deste produto. Confira antes de gerar o XML.</div>` : '';
    const substHTML = r.substituidos.length ? `
        <div class="xml-item-acao" style="margin-top:6px;">
            <button type="button" class="link-discreto" onclick="toggleHistoricoAssociacaoXml('${chaveSubst}')">${substAberto ? 'Ocultar' : 'Ver'} substituídos (${r.substituidos.length}) — só histórico</button>
        </div>
        ${substAberto ? r.substituidos.map(c => `<div class="xml-item-meta" style="margin-top:4px;">${escRel(c.codigoFornecedor)} — substituído${c.ligadoEm ? ` (ligado a este produto em ${formatarDataCompletaBR(c.ligadoEm)})` : ''} · não sugerido</div>`).join('') : ''}` : '';
    const acoesHTML = (usandoReuso || item.spDataReferenciaXml) ? `
        <div class="xml-item-acao" style="margin-top:6px;">
            ${usandoReuso ? `<button type="button" class="central-status-toggle" onclick="manterCodigoOriginalXml(${idx})">Manter código original</button>` : ''}
            ${item.spDataReferenciaXml ? `<button type="button" class="link-discreto" onclick="voltarProdutoAtualReaproveitamentoXml(${idx})">Voltar ao produto atual</button>` : ''}
        </div>` : '';

    return `<div class="xml-item-cotacao" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);">
        <div class="xml-item-meta"><strong>Código de fornecedor já associado a este produto</strong> — SP Data ${escRel(alvo)}${r.produtoNome ? ' — ' + escRel(r.produtoNome) : ''}</div>
        ${r.vigentes.length ? linhas : '<div class="nota-detalhes" style="margin-top:4px;">Nenhum código vigente além do atual.</div>'}
        ${avisoOrdem}${avisoForaDaLista}${acoesHTML}${substHTML}
    </div>`;
}

// "Usar 123 na saída": preenche cProdNovo com o código do FORNECEDOR escolhido.
// A confirmação final "original → novo" (confirmarAlteracoesEExecutar) segue
// obrigatória antes de gerar o XML. Nada é gravado nas associações.
function usarCodigoFornecedorReaproveitadoXml(idx, candidatoIdx) {
    const item = itensXmlDetectados[idx];
    if (!item || !nfeInfoAtual) return;
    const alvo = spDataAlvoReaproveitamentoXml(item);
    if (!alvo) return;
    const r = buscarCodigosFornecedorPorSpData(nfeInfoAtual.cnpjEmit, item.cProd, alvo);
    const c = r.vigentes[candidatoIdx];
    if (!c) return;
    item.cProdNovo = c.codigoFornecedor;
    // Só pro nome do produto aparecer em "Original → Saída" e na confirmação.
    item.possibilidadeEscolhida = { produtoNome: r.produtoNome, spDataCodigo: alvo };
    item.decisaoTomada = 'aplicado_codigo_fornecedor';
    renderAssociacaoCotacaoXml();
    toast(`✓ Código de saída definido: ${c.codigoFornecedor}. O código original (${item.cProd}) continua preservado internamente.`);
}

function voltarProdutoAtualReaproveitamentoXml(idx) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    item.spDataReferenciaXml = null;
    renderAssociacaoCotacaoXml();
}

// Confirmação explícita de "não usar nenhuma associação encontrada" — o
// item já ficaria com o código original por padrão mesmo sem essa ação, mas
// registrar a decisão deixa isso visível no resumo (item 12 do pedido).
function manterCodigoOriginalXml(idx) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    item.cProdNovo = null;
    item.possibilidadeEscolhida = null;
    item.decisaoTomada = 'mantido_original';
    renderAssociacaoCotacaoXml();
    toast('Código original mantido pra este item.');
}

// Visão geral (item 12 do pedido): quantos itens estão em cada situação.
// Só leitura/contagem — não altera nada, não bloqueia nada.
function calcularResumoCodigosXml() {
    if (!itensXmlDetectados.length) return null;
    let semAssociacao = 0, unica = 0, multipla = 0, confirmados = 0, mantidosOriginal = 0;
    itensXmlDetectados.forEach(item => {
        const info = item.associacoesConhecidas;
        if (!info || !info.temAssociacaoConhecida) semAssociacao++;
        else if (info.possibilidades.length === 1) unica++;
        else multipla++;
        if (item.decisaoTomada === 'aplicado_codigo_fornecedor' || item.decisaoTomada === 'aplicado_manual') confirmados++;
        if (!item.cProdNovo || item.cProdNovo === item.cProd) mantidosOriginal++;
    });
    return { total: itensXmlDetectados.length, semAssociacao, unica, multipla, confirmados, mantidosOriginal };
}

function renderResumoCodigosXml() {
    const el = document.getElementById('xml-resumo-codigos');
    if (!el) return;
    const r = calcularResumoCodigosXml();
    if (!r) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<div class="nota-detalhes" style="line-height:1.7;">
        <strong>Situação dos códigos (${r.total} item(ns)):</strong><br>
        ${r.semAssociacao} sem associação conhecida · ${r.unica} com associação única · ${r.multipla} com múltiplas possibilidades<br>
        ${r.confirmados} confirmado(s) pelo usuário (código de saída diferente do original) · ${r.mantidosOriginal} com código original mantido na saída
    </div>`;
}

// Reúne os itens que terão o código do XML de saída diferente do original —
// usado tanto no resumo quanto na confirmação final antes de gerar o XML
// (itens 13/14 do pedido).
function calcularAlteracoesCodigoXml() {
    return itensXmlDetectados.filter(item => item.cProdNovo && item.cProdNovo !== item.cProd);
}

// Confirmação final antes de gerar o XML de saída (Salvar NF ou Baixar XML):
// se algum item tiver código de saída diferente do original, mostra
// exatamente "original → escolhido" pra cada um e só prossegue depois de
// confirmação explícita. Sem alterações pendentes, segue direto (não
// introduz atrito pra quem não está usando essa funcionalidade).
function confirmarAlteracoesEExecutar(acao) {
    const alteracoes = calcularAlteracoesCodigoXml();
    if (alteracoes.length === 0) { acao(); return; }
    const linhas = alteracoes.map(item => `• ${item.xProd}: ${item.cProd} → ${item.cProdNovo}${item.possibilidadeEscolhida && item.possibilidadeEscolhida.produtoNome ? ' (' + item.possibilidadeEscolhida.produtoNome + ')' : ''}`).join('\n');
    showConfirmModal({
        title: 'Confirmar códigos antes de gerar o XML',
        message: `${alteracoes.length} item(ns) terão o código alterado na saída, o original continua preservado internamente:\n\n${linhas}\n\nConfirmar e continuar?`,
        confirmText: 'Confirmar e continuar',
        confirmClass: 'success',
        onConfirm: acao
    });
}

// Usado pelos botões de sugestão automática (buscarSugestoesCotacao): mesma
// decodificação de "pedido::código" que confirmarSelecaoAssociacaoFornecedor,
// só que sem depender do <select> (o valor já vem pronto do botão tocado).
function confirmarSelecaoDireta(chave, valor) {
    if (!valor) return;
    const sep = valor.indexOf('::');
    const pedidoDaAssociacao = sep >= 0 ? valor.slice(0, sep) : null;
    const codigoSmartCompras = sep >= 0 ? valor.slice(sep + 2) : valor;
    confirmarAssociacaoFornecedor(chave, codigoSmartCompras, pedidoDaAssociacao);
}
function confirmarSelecaoAssociacaoFornecedor(chave) {
    const select = document.getElementById(`assoc-forn-select-${chave}`);
    const valor = select ? select.value : '';
    if (!valor) return toast('✕ Selecione um item da cotação antes de confirmar.');
    if (valor === SEM_COTACAO_VALOR) return marcarItemSemCotacaoXml(chave, true);
    // Valor "pedido::código" só existe quando há mais de uma cotação
    // selecionada (evita ambiguidade quando o mesmo código do SmartCompras
    // existe em pedidos diferentes); com uma só cotação, o valor é o código puro.
    const sep = valor.indexOf('::');
    const pedidoDaAssociacao = sep >= 0 ? valor.slice(0, sep) : null;
    const codigoSmartCompras = sep >= 0 ? valor.slice(sep + 2) : valor;
    confirmarAssociacaoFornecedor(chave, codigoSmartCompras, pedidoDaAssociacao);
}

// Compra direta: o item não passa pela associação com a cotação (só SP Data).
function marcarItemSemCotacaoXml(chave, valor) {
    if (!nfeInfoAtual) return;
    const item = itensXmlDetectados.find(i => chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, i.cProd) === chave);
    if (!item) return;
    item.semCotacao = !!valor;
    associacaoFornecedorBuscaAberta.delete(chave);
    if (valor) toast('Item marcado como compra direta (sem cotação do SmartCompras).');
    renderAssociacaoCotacaoXml();
}

// Atalho da NF inteira sem cotação do SmartCompras. Guarda o pedido que estava
// definido pra poder desmarcar sem perder nada.
function alternarSemCotacaoNfXml(marcado) {
    if (!nfeInfoAtual) return;
    if (marcado) {
        pedidoAntesSemCotacaoXml = { pedido: pedidoSelecionadoXml, origem: pedidoOrigemXml, conflito: conflitoPedidoXmlInfo, sugestao: pedidoSugestaoXmlInfo, adicionais: pedidosAdicionaisXml };
        pedidoSelecionadoXml = null; pedidoOrigemXml = null; conflitoPedidoXmlInfo = null; pedidoSugestaoXmlInfo = null; pedidosAdicionaisXml = [];
        semCotacaoNfXml = true;
        itensXmlDetectados.forEach(i => { i.semCotacao = true; });
    } else {
        semCotacaoNfXml = false;
        itensXmlDetectados.forEach(i => { i.semCotacao = false; });
        if (pedidoAntesSemCotacaoXml) {
            pedidoSelecionadoXml = pedidoAntesSemCotacaoXml.pedido; pedidoOrigemXml = pedidoAntesSemCotacaoXml.origem;
            conflitoPedidoXmlInfo = pedidoAntesSemCotacaoXml.conflito; pedidoSugestaoXmlInfo = pedidoAntesSemCotacaoXml.sugestao;
            pedidosAdicionaisXml = pedidoAntesSemCotacaoXml.adicionais || [];
        }
        pedidoAntesSemCotacaoXml = null;
    }
    renderAssociacaoCotacaoXml();
}

function definirDestinoSemCotacaoXml(valor) {
    destinoSemCotacaoXml = valor || '';
    renderAssociacaoCotacaoXml();
}

async function confirmarAssociacaoFornecedor(chave, codigoSmartCompras, pedidoDaAssociacao) {
    if (!chave || !codigoSmartCompras || !nfeInfoAtual) return;
    const item = itensXmlDetectados.find(i => chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, i.cProd) === chave);
    if (!item) return;
    item.semCotacao = false; // escolheu um item da cotação: deixa de ser compra direta

    const agora = new Date().toISOString();
    const existente = bancoAssociacoesFornecedor[chave];
    const jaEraEssa = existente && existente.codigoSmartCompras === codigoSmartCompras;
    const historico = existente ? [...(existente.historico || [])] : [];
    if (!jaEraEssa) historico.push({ codigoSmartCompras, confirmadoEm: agora, tipo: existente ? 'correcao' : 'confirmacao' });

    try {
        await associacoesFornecedorCollection.doc(chave).set({
            cnpjFornecedor: nfeInfoAtual.cnpjEmit,
            codigoFornecedor: item.cProd,
            codigoSmartCompras,
            ...(pedidoDaAssociacao ? { pedido: pedidoDaAssociacao } : {}),
            nfNumero: nfeInfoAtual.nNF || '',
            confirmadoEm: agora,
            historico
        });
        associacaoFornecedorBuscaAberta.delete(chave);
        toast('✓ Associação com a cotação confirmada.');
    } catch (e) {
        console.error('Erro ao confirmar associação de fornecedor:', e);
        toast('✕ Erro ao associar. Tente novamente.');
    }
}

// Grava o "lado NF" da comparação de 3 fontes (Cotação × NF/XML × ERP),
// automaticamente a cada download — mesmos dados já calculados na tela
// (associação fornecedor→cotação→SP Data, quantidade/valor já com a
// conversão aplicada). Não cria associação nova nenhuma, só um retrato do
// que foi faturado nesta NF especificamente.
function montarNfProcessadaAtual(opcoes) {
    opcoes = opcoes || {};
    if (!nfeInfoAtual || !itensXmlDetectados.length) return null;
    const chave = nfeInfoAtual.serie ? `${nfeInfoAtual.nNF}_${nfeInfoAtual.serie}` : nfeInfoAtual.nNF;
    if (!chave) return null;

    const pedidosSelecionados = cotacoesSelecionadasXml();
    const multi = pedidosSelecionados.length > 1;
    const itens = itensXmlDetectados
        .filter(item => !(opcoes.soConfirmados && item.suspeito))
        .map(item => {
            const st = statusItemXml(item);
            const direto = !!item.semCotacao;
            const associacao = direto ? null : bancoAssociacoesFornecedor[st.chave];
            const chaveSpData = direto ? st.chaveDireta : (associacao ? associacao.codigoSmartCompras : null);
            const associacaoSpData = chaveSpData ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === chaveSpData) : null;
            const rec = direto ? recursoPrevistoItemXml(item, st) : null;
            // Com mais de uma cotação na NF, cada linha precisa saber de QUAL
            // pedido é seu código (o mesmo código do SmartCompras pode existir
            // em pedidos diferentes) — sem isso a conferência por pedido
            // poderia contar o item no pedido errado.
            // Associação sem o pedido gravado (ex.: confirmada antes de esta NF
            // virar multi-pedido, como no caminho automático que reaproveita
            // associações antigas): acha, entre as cotações selecionadas, qual
            // delas realmente TEM esse código — só cai no pedido principal se o
            // código existir em mais de uma (aí sim é ambíguo de verdade).
            let pedidoItem = null;
            if (multi && associacao) {
                if (associacao.pedido) pedidoItem = associacao.pedido;
                else {
                    const donos = pedidosSelecionados.filter(p => {
                        const c = listaCotacoes.find(cc => cc.pedido === p);
                        return c && (c.itens || []).some(i => i.codProduto === associacao.codigoSmartCompras);
                    });
                    pedidoItem = donos.length === 1 ? donos[0] : pedidoSelecionadoXml;
                }
            }
            return {
                cProd: item.cProd,
                xProd: item.xProd,
                codigoSmartCompras: associacao ? associacao.codigoSmartCompras : null,
                codigoSpData: associacaoSpData ? associacaoSpData.spDataCodigo : null,
                quantidade: parseFloat((item.qComOriginal * item.fator).toFixed(4)),
                valorUnitario: parseFloat((item.vUnComOriginal / item.fator).toFixed(4)),
                fatorAplicado: item.fator,
                // Fase 43: lote/validade confirmados (ou do <rastro> do XML) — campos novos, só quando existem.
                ...(item.rastroDecidido ? { lote: item.rastroDecidido.lote, validade: item.rastroDecidido.validadeISO }
                    : (item.rastros.length && item.rastros[0].nLote ? { lote: item.rastros[0].nLote, ...(item.rastros[0].dVal ? { validade: item.rastros[0].dVal } : {}) } : {})),
                // Fase 30: só quando o código de saída difere do original (NFs antigas não têm o campo).
                ...((item.cProdNovo && item.cProdNovo !== item.cProd) ? { cProdSaida: item.cProdNovo } : {}),
                ...(direto ? { semCotacao: true, recurso: (rec && rec.valor) || null } : {}),
                ...(pedidoItem ? { pedidoItem } : {})
            };
        });

    const algumDireto = itensXmlDetectados.some(i => i.semCotacao);
    const cotSel = pedidoSelecionadoXml ? listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml) : null;
    const doc = {
        nf: nfeInfoAtual.nNF,
        serie: nfeInfoAtual.serie,
        cnpjFornecedor: nfeInfoAtual.cnpjEmit,
        fornecedor: nfeInfoAtual.fornecedor,
        emissao: nfeInfoAtual.emissao,
        valorTotal: nfeInfoAtual.valorTotal,
        ...((nfeInfoAtual.vencimentos || []).length ? { vencimentos: nfeInfoAtual.vencimentos } : {}), // Fase 44
        pedido: pedidoSelecionadoXml,
        itens,
        processadoEm: new Date().toISOString(),
        ...(algumDireto ? { semCotacaoSmartCompras: itensXmlDetectados.every(i => i.semCotacao), destino: (cotSel && cotSel.origem) || destinoSemCotacaoXml || null } : {}),
        ...(multi ? { pedidos: pedidosSelecionados } : {})
    };
    return { chave, doc };
}

async function salvarNfProcessada() {
    const montada = montarNfProcessadaAtual();
    if (!montada) return;
    await nfsProcessadasCollection.doc(montada.chave).set(montada.doc);
}

// ===================================================================
// --- COMPARAÇÃO DE 3 FONTES: COTAÇÃO × NF/XML × ERP (por pedido) ---
// ===================================================================
// Só leitura/derivação — nenhuma associação nova, nenhuma gravação
// automática de divergência. Casa os itens pelas chaves que já existem:
// codigoSmartCompras (cotação ↔ NF) e codigoSpData (NF ↔ ERP, via
// entradasErp.itens[].codigoSpData e vinculo.pedido).
function compararFontesPedido(pedido, opcoes) {
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!cotacao) return [];

    // NF de mais de um pedido: nf.pedido é sempre o principal (compatível com
    // toda NF já salva antes desta funcionalidade); nf.pedidos (plural) só
    // existe quando a NF tem itens de mais de uma cotação.
    const nfPertenceAoPedido = nf => nf.pedido === pedido || (nf.pedidos && nf.pedidos.includes(pedido));
    // opcoes.nfExtra = a NF que está sendo tratada na tela (ainda não salva, ou
    // já salva): entra na conta no lugar da gravada, sem gravar nada.
    const nfExtra = opcoes && opcoes.nfExtra && nfPertenceAoPedido(opcoes.nfExtra) ? opcoes.nfExtra : null;
    // Fase 31 (só leitura): opcoes.nfIds limita as NFs do app (usado pra reconstruir o
    // histórico "NF a NF" da entrega) e opcoes.semErp ignora o ERP nessa reconstrução.
    const apenasNfIds = opcoes && opcoes.nfIds ? opcoes.nfIds : null;
    const nfsDoPedido = listaNfsProcessadas.filter(nf => nfPertenceAoPedido(nf) && !(nfExtra && nf.id === nfExtra.id) && (!apenasNfIds || apenasNfIds.includes(nf.id))).concat(nfExtra ? [nfExtra] : []);
    const entradasErpDoPedido = (opcoes && opcoes.semErp) ? [] : listaEntradasErp.filter(e => e.vinculo && e.vinculo.status === 'confirmado' && e.vinculo.pedido === pedido);
    // Fase 31: fornecedor com mais de um CNPJ (mesma entidade) — a entrada do ERP pode
    // estar no CNPJ irmão do que está na cotação. Sem entidade cadastrada, vale só o CNPJ exato.
    const cacheEntidade = {};
    const entidadeDe = c => cacheEntidade[c] || (cacheEntidade[c] = cnpjsDaMesmaEntidadeFornecedor(c));
    // Só sinaliza "não faturado" quando o pedido já tem alguma NF processada —
    // um pedido que ainda nem começou a ser atendido não é uma divergência,
    // é só um pedido em aberto. E soma TODAS as NFs do pedido antes de
    // concluir que um item ficou faltando (pode vir em outra NF depois).
    const pedidoTemNf = nfsDoPedido.length > 0;

    return (cotacao.itens || []).map(itemCotacao => {
        const nome = itemCotacao.nomeOficial || itemCotacao.descricao || itemCotacao.codProduto;
        // Numa NF de um pedido só (a grande maioria), it.pedidoItem nem existe
        // — conta normal, como sempre foi. Só quando a NF tem mais de um
        // pedido (it.pedidoItem presente) é que o código precisa bater com
        // ESTE pedido, pra não contar um item do pedido errado (o mesmo
        // código do SmartCompras pode existir em pedidos diferentes).
        const itensNf = nfsDoPedido.flatMap(nf => (nf.itens || [])
            .filter(it => it.codigoSmartCompras === itemCotacao.codProduto && (!it.pedidoItem || it.pedidoItem === pedido))
            .map(it => ({ ...it, nfNumero: nf.nf })));
        const quantidadeFaturada = itensNf.length ? itensNf.reduce((s, it) => s + it.quantidade, 0) : null;
        // SmartCompras e SP Data às vezes registram o mesmo produto em
        // unidades diferentes (ex.: cotação em frasco, dispensação em gotas
        // ou em doses — 500 gotas ou 60 doses por frasco). O Fator de
        // conversão confirmado na Entrada de NF é exatamente essa razão, então
        // se a quantidade cotada bate com a faturada DEPOIS de desfazer essa
        // conversão, não é divergência — é só a unidade sendo diferente.
        // Só sinaliza quando NENHUMA das duas contas fecha (nem direta, nem
        // convertida), pra nunca deixar passar uma quantidade genuinamente
        // errada. NFs sem fator registrado (antigas) contam como fator 1,
        // então a conta convertida vira igual à direta — sem regressão.
        const quantidadeFaturadaConvertida = itensNf.length
            ? itensNf.reduce((s, it) => s + it.quantidade / (it.fatorAplicado || 1), 0)
            : null;
        const valorUnitarioFaturado = itensNf.length ? itensNf[itensNf.length - 1].valorUnitario : null;
        const codigoSpDataNf = itensNf.find(it => it.codigoSpData)?.codigoSpData || null;
        // Fase 29: sem SP Data vindo da NF, usa a associação SP Data já confirmada
        // do item da cotação (determinística) — permite cruzar com uma entrada do
        // ERP vinculada ao pedido mesmo sem NF/XML (auditoria retroativa).
        const assocSdItem = (!codigoSpDataNf && itemCotacao.codProduto) ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === itemCotacao.codProduto) : null;
        const codigoSpData = codigoSpDataNf || (assocSdItem ? assocSdItem.spDataCodigo : null);
        const nfsQueFaturaram = [...new Set(itensNf.map(it => it.nfNumero))];

        const entradasErpDoItem = codigoSpDataNf ? entradasErpDoPedido : entradasErpDoPedido.filter(e => cnpjEmLista(entidadeDe(itemCotacao.cnpjFornecedor), e.vinculo.cnpjFornecedor || e.cnpjFornecedor));
        // 2.0.5: com NF do app no item, o ERP só conta se for da MESMA NF (mesmo número) — antes somava as entradas de TODAS as NFs
        // do pedido e gerava "divergência fantasma" (ex.: NF de 30 un. contra 70 lançadas, sendo 40 de outra NF). E a mesma NF
        // importada duas vezes no ERP entra uma vez só.
        const numerosNfDoItem = new Set(itensNf.map(x => normNfNumero(x.nfNumero)));
        const vistasErp = new Set();
        const entradasErpComparaveis = itensNf.length
            ? entradasErpDoItem.filter(e => {
                const num = normNfNumero(e.nf); if (!numerosNfDoItem.has(num)) return false;
                const k = num + '|' + normalizarCnpj(e.cnpjFornecedor || (e.vinculo && e.vinculo.cnpjFornecedor) || '');
                if (vistasErp.has(k)) return false; vistasErp.add(k); return true;
            })
            : entradasErpDoItem;
        const itensErp = codigoSpData ? entradasErpComparaveis.flatMap(e => (e.itens || []).filter(it => it.codigoSpData === codigoSpData)) : [];
        const quantidadeLancada = itensErp.length ? itensErp.reduce((s, it) => s + it.quantidade, 0) : null;

        const divergencias = [];
        // Fase 31: quanto da entrega deste item já está comprovado — 'nf_completa' (NF/XML do app
        // cobre a quantidade cotada, direta ou convertida), 'nf_parcial' (NF cobre menos que o
        // cotado), 'erp_*' (só ERP, sem NF no app — ver Fase 31.1 abaixo) ou null (nenhuma evidência).
        // Fase 31.1: item só no ERP. O ERP traz quantidade na unidade de DISPENSAÇÃO (SP Data) e a
        // cotação não guarda unidade nem fator — então a quantidade não é comparável por si só.
        // Só se compara quando TODAS as linhas do ERP deste produto têm o mesmo valor unitário da
        // cotação (mesmo critério da Fase 8): preço por unidade igual => mesma unidade => a
        // quantidade pode ser comparada. Senão: 'erp_sem_quantidade' (NF existe, mas não dá pra
        // afirmar quanto chegou — nunca conta como entregue).
        //   'erp_completa' = ERP >= cotado · 'erp_parcial' = ERP < cotado.
        let cobertura = null;
        let quantidadeEntregue = null; // na unidade da cotação, só quando é comparável
        if (!itensNf.length) {
            if (itensErp.length) {
                const qtdCotErp = numeroFlexivel(itemCotacao.quantidade);
                const precoCotErp = numeroFlexivel(itemCotacao.precoUnitario);
                const produtoErp = listaProdutosSpData.find(pr => pr.codigo === codigoSpData) || {};
                const mesmaUnidade = !produtoErp.ignorarDivergenciaUnidade && qtdCotErp !== null && precoCotErp !== null
                    && Number.isFinite(quantidadeLancada)
                    && itensErp.every(it => Number.isFinite(it.valorUnitario) && Math.abs(it.valorUnitario - precoCotErp) < 0.01);
                if (!mesmaUnidade) cobertura = 'erp_sem_quantidade';
                else {
                    quantidadeEntregue = quantidadeLancada;
                    cobertura = quantidadeLancada >= qtdCotErp - 0.001 ? 'erp_completa' : 'erp_parcial';
                }
            }
            // Fase 28: fornecedor marcado como "já chegou" (sem NF no app) não gera "não faturado".
            // Item já lançado no ERP (entrada vinculada ao pedido) também não é "não faturado".
            // Fase 36: só gera "não faturado" quando ESTE fornecedor já deu entrada de NF (XML do app) neste
            // pedido e este item ficou de fora. Fornecedor que ainda não entregou nada = "aguardando", sem alarme.
            const fornecedorJaDeuEntrada = pedidoTemNf && nfsDoPedido.some(nf => cnpjEmLista(entidadeDe(itemCotacao.cnpjFornecedor), nf.cnpjFornecedor));
            if (fornecedorJaDeuEntrada && !itensErp.length && !(cotacao.chegadasPorFornecedor || {})[normalizarCnpj(itemCotacao.cnpjFornecedor)]) {
                divergencias.push({ tipo: 'nao_faturado', nome, quantidadeCotada: itemCotacao.quantidade });
            }
        } else {
            // Produto sinalizado no SP Data (ex.: insulinas — cotado numa unidade,
            // recebido/dispensado em outra): quantidade e valor unitário não são
            // comparáveis, então essas duas divergências não são geradas.
            const ignoraUnidade = !!(codigoSpData && (listaProdutosSpData.find(pr => pr.codigo === codigoSpData) || {}).ignorarDivergenciaUnidade);
            const bateDireto = ignoraUnidade || Number(itemCotacao.quantidade) === quantidadeFaturada;
            const bateConvertido = Math.abs(Number(itemCotacao.quantidade) - quantidadeFaturadaConvertida) < 0.01;
            const qtdCotadaNum = Number(itemCotacao.quantidade);
            cobertura = (bateDireto || bateConvertido || !Number.isFinite(qtdCotadaNum) || quantidadeFaturada > qtdCotadaNum || quantidadeFaturadaConvertida > qtdCotadaNum) ? 'nf_completa' : 'nf_parcial';
            // Soma de TODAS as NFs do pedido pra este produto, já na unidade da cotação.
            quantidadeEntregue = ignoraUnidade ? null : Math.round(quantidadeFaturadaConvertida * 100) / 100;
            if (!bateDireto && !bateConvertido) {
                divergencias.push({ tipo: 'quantidade_cotada_nf', nome, quantidadeCotada: itemCotacao.quantidade, quantidadeFaturada, nfs: nfsQueFaturaram });
            }
            if (quantidadeLancada !== null && quantidadeLancada !== quantidadeFaturada) {
                divergencias.push({ tipo: 'quantidade_nf_erp', nome, quantidadeFaturada, quantidadeLancada, nfs: nfsQueFaturaram });
            }
            // Fase 42: valor NF × ERP. Os dois lados estão na unidade de DISPENSAÇÃO (NF = quantidade × fator, valor ÷ fator),
            // então dá pra comparar direto. Qualquer diferença é divergência — desconto e IPI não são compensados (regra do hospital:
            // no SPData eles se somam num item da NF). Total só é comparado quando as quantidades batem (senão a diferença de
            // quantidade já explica a de total e não vale avisar duas vezes).
            if (itensErp.length) {
                const linhaNf = it => (Number.isFinite(it.quantidade) && Number.isFinite(it.valorUnitario)) ? it.quantidade * it.valorUnitario : null;
                const linhaErp = it => (Number.isFinite(it.valorTotal) && it.valorTotal > 0) ? it.valorTotal : ((Number.isFinite(it.quantidade) && Number.isFinite(it.valorUnitario)) ? it.quantidade * it.valorUnitario : null);
                const totaisNf = itensNf.map(linhaNf), totaisErp = itensErp.map(linhaErp);
                if (totaisNf.every(v => v !== null) && totaisErp.every(v => v !== null) && quantidadeFaturada > 0 && quantidadeLancada > 0) {
                    const valorTotalNf = totaisNf.reduce((a, b) => a + b, 0), valorTotalErp = totaisErp.reduce((a, b) => a + b, 0);
                    const unitarioNf = valorTotalNf / quantidadeFaturada, unitarioErp = valorTotalErp / quantidadeLancada;
                    const difUnitario = Math.abs(unitarioNf - unitarioErp) > 0.005;
                    const mesmaQtd = Math.abs(quantidadeFaturada - quantidadeLancada) < 0.001;
                    const difTotal = mesmaQtd && Math.abs(valorTotalNf - valorTotalErp) > Math.max(0.02, valorTotalNf * 0.0005);
                    if (difUnitario || difTotal) {
                        divergencias.push({ tipo: 'valor_nf_erp', nome, valorUnitarioNf: unitarioNf, valorUnitarioErp: unitarioErp, valorTotalNf, valorTotalErp, difUnitario, difTotal, nfs: nfsQueFaturaram });
                    }
                }
            }
            if (!ignoraUnidade && valorUnitarioFaturado !== null && itemCotacao.precoUnitario) {
                const cotado = parseFloat(itemCotacao.precoUnitario);
                const fatorUltimoItem = itensNf[itensNf.length - 1].fatorAplicado || 1;
                const bateDiretoValor = Math.abs(cotado - valorUnitarioFaturado) <= 0.005;
                const bateConvertidoValor = Math.abs(cotado - valorUnitarioFaturado * fatorUltimoItem) <= 0.005;
                if (!bateDiretoValor && !bateConvertidoValor) {
                    divergencias.push({ tipo: 'valor_cotado_nf', nome, valorCotado: cotado, valorFaturado: valorUnitarioFaturado, nfs: nfsQueFaturaram });
                }
            }
        }

        return {
            codProduto: itemCotacao.codProduto,
            cnpjFornecedor: itemCotacao.cnpjFornecedor,
            nome,
            quantidadeCotada: itemCotacao.quantidade,
            quantidadeFaturada, quantidadeLancada, quantidadeEntregue,
            temNf: itensNf.length > 0, temErp: itensErp.length > 0,
            nfs: nfsQueFaturaram, codigoSpData,
            cobertura,
            divergencias,
            resolvido: (cotacao.resolvidosPorItem || {})[itemCotacao.codProduto] || null
        };
    });
}

// ===================================================================
// --- FASE 31: STATUS DE ENTREGA DO FORNECEDOR (calculado, só leitura) ---
// ===================================================================
// "Já chegou" deixa de depender só do clique manual. Por fornecedor do pedido:
//  - cada produto cotado conta como ENTREGUE quando há evidência: NF/XML do app com a
//    quantidade cotada (direta ou convertida — mesma conta da comparação, vide `cobertura`),
//    entrada do ERP associada ao pedido SÓ quando a quantidade dela é comparável com segurança
//    (valor unitário igual ao da cotação — ver Fase 31.1), ou divergência marcada como "Resolvido";
//  - TODAS as NFs do pedido entram na conta (já era assim: o app soma as NFs do pedido);
//  - tudo coberto = "completa" (automático); parte coberta = "parcial"; só uma NF do ERP
//    sem item identificado = "erp_sem_itens"; nada = "aguardando";
//  - a marca manual (chegadasPorFornecedor) continua valendo como EXCEÇÃO: só pesa quando o
//    cálculo automático não chega em "completa" e fica sempre identificada como manual.
// Nada é gravado aqui. "Confere" (sem divergência) é um subconjunto de "entregue": um item
// com divergência de valor ou de quantidade a mais também chegou.
function nfErpTemXmlNoApp(entradaErp, entidade) {
    return listaNfsProcessadas.some(nf => nf.nf === entradaErp.nf
        && (!nf.serie || !entradaErp.serie || nf.serie === entradaErp.serie)
        && cnpjEmLista(entidade, nf.cnpjFornecedor));
}
function calcularEntregaFornecedorPedido(pedido, fornecedor, compItens) {
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!cotacao || !fornecedor) return null;
    const chave = normalizarCnpj(fornecedor.cnpj);
    const produtos = (cotacao.itens || []).filter(it => normalizarCnpj(it.cnpjFornecedor) === chave);
    const entidade = cnpjsDaMesmaEntidadeFornecedor(fornecedor.cnpj);
    const manual = (cotacao.chegadasPorFornecedor || {})[chave] || null;
    const codigos = new Set(produtos.map(p => p.codProduto));
    const nfPertence = nf => nf.pedido === pedido || (nf.pedidos && nf.pedidos.includes(pedido));

    const nfsApp = listaNfsProcessadas
        .filter(nf => nfPertence(nf) && (nf.itens || []).some(it => codigos.has(it.codigoSmartCompras) && (!it.pedidoItem || it.pedidoItem === pedido)))
        .map(nf => ({ id: nf.id, nf: nf.nf, serie: nf.serie || '', ts: nf.processadoEm || '', data: (nf.processadoEm || '').slice(0, 10) || null }))
        .sort((a, b) => a.ts.localeCompare(b.ts));
    const nfsErp = listaEntradasErp
        .filter(e => e.vinculo && e.vinculo.status === 'confirmado' && e.vinculo.pedido === pedido && cnpjEmLista(entidade, e.vinculo.cnpjFornecedor || e.cnpjFornecedor))
        .map(e => ({ id: e.id, nf: e.nf, serie: e.serie || '', data: converterDataBRparaISO(e.data) || (e.atualizadoEm || '').slice(0, 10) || null, xmlNoApp: nfErpTemXmlNoApp(e, entidade) }));

    const itens = produtos.map(p => {
        const c = (compItens || []).find(x => x.codProduto === p.codProduto);
        let situacao = 'pendente';
        if (c) {
            if (c.divergencias.length && c.resolvido) situacao = 'resolvido';
            else if (c.cobertura === 'nf_completa') situacao = 'nf';
            else if (c.cobertura === 'erp_completa') situacao = 'erp';
            else if (c.cobertura === 'nf_parcial' || c.cobertura === 'erp_parcial') situacao = 'parcial';
            else if (c.cobertura === 'erp_sem_quantidade') situacao = 'erp_sem_quantidade';
        }
        const nome = p.nomeOficial || p.descricao || p.codProduto;
        const qtdTxt = (c && c.quantidadeEntregue !== null && c.quantidadeEntregue !== undefined && p.quantidade !== undefined && p.quantidade !== '') ? ` (${c.quantidadeEntregue}/${numeroFlexivel(p.quantidade) !== null ? numeroFlexivel(p.quantidade) : p.quantidade})` : '';
        return { codProduto: p.codProduto, nome, nomeComQuantidade: nome + qtdTxt, situacao };
    });
    const total = itens.length;
    const cobertos = itens.filter(i => i.situacao === 'nf' || i.situacao === 'erp' || i.situacao === 'resolvido').length;
    const parciais = itens.filter(i => i.situacao === 'parcial').length;
    const pendentes = itens.filter(i => i.situacao === 'pendente').length;
    const semQuantidade = itens.filter(i => i.situacao === 'erp_sem_quantidade');
    const faltando = itens.filter(i => i.situacao === 'pendente' || i.situacao === 'parcial').map(i => i.nomeComQuantidade);

    // 'erp_sem_itens' = há NF/linha no ERP, mas o app não consegue afirmar quanto chegou (nunca "completa").
    let estadoAuto;
    if (total && cobertos === total) estadoAuto = 'completa';
    else if (parciais > 0 || (cobertos > 0 && pendentes > 0)) estadoAuto = 'parcial';
    else if (cobertos > 0 || semQuantidade.length || nfsErp.length) estadoAuto = 'erp_sem_itens';
    else estadoAuto = 'aguardando';

    let estado = estadoAuto, origem = null;
    if (estadoAuto === 'completa') {
        const usaNf = itens.some(i => i.situacao === 'nf'), usaErp = itens.some(i => i.situacao === 'erp');
        origem = usaNf && usaErp ? 'misto' : usaErp ? 'erp' : 'xml';
    } else if (manual) {
        estado = 'completa';
        origem = manual.tipo === 'parcial_resolvida' ? 'parcial_resolvida' : 'manual';
    }

    const datas = nfsApp.map(n => n.data).concat(nfsErp.map(n => n.data)).filter(Boolean).sort();
    const dataChegada = estadoAuto === 'completa' ? (datas[datas.length - 1] || null) : (manual ? manual.data || null : null);
    const primeiraEvidencia = datas[0] || null;

    // Histórico "NF a NF" (só quando há 2+ NFs do app): quantos itens estavam cobertos depois de cada uma.
    let passos = [];
    if (nfsApp.length >= 2 && total) {
        passos = nfsApp.map((n, i) => {
            const ids = nfsApp.slice(0, i + 1).map(x => x.id);
            const comp = compararFontesPedido(pedido, { nfIds: ids, semErp: true }).filter(x => normalizarCnpj(x.cnpjFornecedor) === chave);
            return { nf: n.nf, serie: n.serie, data: n.data, cobertos: comp.filter(x => x.cobertura === 'nf_completa').length, total };
        });
    }
    return { estado, estadoAuto, origem, total, cobertos, parciais, faltando, semQuantidade: semQuantidade.map(i => i.nome), itens, nfsApp, nfsErp, manual, dataChegada, primeiraEvidencia, passos };
}

// Texto/classe do selo e frases de apoio do card do fornecedor.
function rotuloEntregaFornecedor(e) {
    if (!e) return { texto: '', classe: 'neutro' };
    if (e.estado === 'completa') {
        if (e.origem === 'manual') return { texto: '✓ Já chegou (confirmado manualmente)', classe: 'pronto', curto: '✓ já chegou (manual)' };
        if (e.origem === 'parcial_resolvida') return { texto: '✓ Entrega parcial resolvida (manual)', classe: 'pronto', curto: '✓ parcial resolvida (manual)' };
        return { texto: '✓ Entrega completa', classe: 'pronto', curto: '✓ entrega completa' };
    }
    if (e.estado === 'parcial') return { texto: `◐ Entrega parcial (${e.cobertos}/${e.total} itens)`, classe: 'pendente', curto: `◐ parcial ${e.cobertos}/${e.total}` };
    if (e.estado === 'erp_sem_itens') return { texto: '◐ NF no ERP — itens/quantidades não conferidos', classe: 'neutro', curto: '◐ NF no ERP' };
    return { texto: '○ Aguardando entrega', classe: 'neutro', curto: '○ aguardando entrega' };
}
function renderEntregaFornecedorHTML(pedido, fornecedor, e) {
    if (!e) return '';
    const r = rotuloEntregaFornecedor(e);
    const fmtNf = n => `NF ${escRel(n.nf)}${n.serie ? '/' + escRel(n.serie) : ''}${n.data ? ' (' + formatarDataBRSimples(n.data) + ')' : ''}`;
    const linhas = [];
    if (e.estado === 'completa' && e.origem === 'xml') linhas.push(`Calculado pelo XML processado no app${e.dataChegada ? ' · concluída em ' + formatarDataBRSimples(e.dataChegada) : ''}.`);
    else if (e.estado === 'completa' && e.origem === 'erp') linhas.push(`Calculado pela entrada registrada no ERP${e.dataChegada ? ' · em ' + formatarDataBRSimples(e.dataChegada) : ''}.`);
    else if (e.estado === 'completa' && e.origem === 'misto') linhas.push(`Calculado por XML no app + entrada no ERP${e.dataChegada ? ' · concluída em ' + formatarDataBRSimples(e.dataChegada) : ''}.`);
    else if (e.manual) linhas.push(`${e.origem === 'parcial_resolvida' ? 'Parcial marcada como resolvida' : 'Marcado como já chegou'} manualmente${e.manual.data ? ' em ' + formatarDataBRSimples(e.manual.data) : ''} — o app não tem NF/ERP que comprove todos os itens.`);
    if (e.manual && e.estadoAuto === 'completa') linhas.push(`Também havia marca manual em ${formatarDataBRSimples(e.manual.data)} (já não é necessária).`);
    if (e.estado !== 'completa' || e.estadoAuto !== 'completa') {
        if (e.total) linhas.push(`Itens com entrega comprovada: ${e.cobertos}/${e.total}.`);
        if (e.faltando.length) linhas.push(`Faltam: ${e.faltando.slice(0, 3).map(escRel).join(', ')}${e.faltando.length > 3 ? ' e mais ' + (e.faltando.length - 3) : ''}.`);
        if (e.semQuantidade.length) linhas.push(`No ERP, mas sem como conferir a quantidade (o valor unitário não bate com a cotação): ${e.semQuantidade.slice(0, 3).map(escRel).join(', ')}${e.semQuantidade.length > 3 ? ' e mais ' + (e.semQuantidade.length - 3) : ''}.`);
    }
    if (e.nfsApp.length) linhas.push(`XML no app: ${e.nfsApp.map(fmtNf).join(' · ')}.`);
    if (e.passos.length) linhas.push(`Histórico: ${e.passos.map(p => `${fmtNf(p)} → ${p.cobertos}/${p.total} itens`).join(' · ')}.`);
    const botoes = e.manual
        ? `<button type="button" class="central-status-toggle" onclick="alterarChegadaFornecedorCotacao('${pedido}', '${fornecedor.cnpj}', false)">Desfazer marca manual</button>`
        : e.estadoAuto === 'completa' ? ''
        : e.estadoAuto === 'parcial'
            ? `<button type="button" class="central-status-toggle" onclick="alterarChegadaFornecedorCotacao('${pedido}', '${fornecedor.cnpj}', true, 'parcial_resolvida')">Marcar parcial como resolvida</button>`
            : `<button type="button" class="central-status-toggle" onclick="alterarChegadaFornecedorCotacao('${pedido}', '${fornecedor.cnpj}', true)">Marcar como já chegou</button>`;
    return `<div class="central-chegada"><span class="xml-item-badge ${r.classe}">${r.texto}</span> ${botoes}</div>${linhas.map(l => `<div class="central-item-meta">${l}</div>`).join('')}`;
}

// Monta a frase da divergência em linguagem natural (não burocrática), pra
// já entrar pronta no campo de observação da Nova Auditoria — o usuário
// ainda pode editar antes de salvar.
function textoDivergenciaNatural(div) {
    switch (div.tipo) {
        case 'nao_faturado':
            return `O produto ${div.nome} foi incluído na cotação (${div.quantidadeCotada} un.), porém ainda não foi faturado em nenhuma NF já processada deste pedido — pode ser complementado por outra NF.`;
        case 'quantidade_cotada_nf':
            return `Foi pedido ${div.nome} na quantidade de ${div.quantidadeCotada}, porém foi faturado na quantidade de ${div.quantidadeFaturada}${div.nfs && div.nfs.length ? `, pela NF ${div.nfs.join(', ')}` : ''}.`;
        case 'quantidade_nf_erp':
            return `${div.nome} foi faturado com quantidade ${div.quantidadeFaturada}${div.nfs && div.nfs.length ? ` (NF ${div.nfs.join(', ')})` : ''}, mas foi lançado no ERP com quantidade ${div.quantidadeLancada}.`;
        case 'valor_nf_erp': {
            const fmt = v => (Math.round(v * 10000) / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            const partes = [];
            if (div.difUnitario) partes.push(`valor unitário R$ ${fmt(div.valorUnitarioNf)} na NF × R$ ${fmt(div.valorUnitarioErp)} no ERP`);
            if (div.difTotal) partes.push(`valor total R$ ${fmt(div.valorTotalNf)} na NF × R$ ${fmt(div.valorTotalErp)} no ERP`);
            return `${div.nome}${div.nfs && div.nfs.length ? ` (NF ${div.nfs.join(', ')})` : ''}: ${partes.join('; ')}.`;
        }
        case 'valor_cotado_nf':
            return `${div.nome} foi cotado a R$ ${div.valorCotado.toFixed(2)}, porém foi faturado a R$ ${div.valorFaturado.toFixed(2)}${div.nfs && div.nfs.length ? ` (NF ${div.nfs.join(', ')})` : ''}.`;
        default:
            return `Divergência em ${div.nome}.`;
    }
}

// ===================================================================
// --- FASE 11: APTIDÃO PARA SAÍDA (só leitura — nada é persistido aqui) ---
// ===================================================================
// Cruza a nota financeira (notasCollection) com o que a Entrada Segura e a
// Auditoria já sabem, pra dizer "está apta ou não, e por quê" — sem criar
// nenhum campo/coleção nova e sem bloquear nada (a seleção de fato pra
// repasse é a Fase 12). Reaproveita compararFontesPedido (mesma fonte da
// Central do Pedido/Auditoria) e listaAnotacoes (Fase 10).
//
// Nunca decide por aproximação: só liga a nota à NF processada quando o
// número da NF bate (normalizado, igual à regra já usada em
// verificarDuplicidade) — e, quando a nota veio da pré-seleção do ERP
// (entradaVinculada), também exige o mesmo CNPJ, pra nunca cruzar com a NF
// errada de outro fornecedor que por acaso tenha o mesmo número.
// Calcula a aptidão pra saída de uma nota (Fase 11) e, junto, os dados
// complementares que a Fase 12 (seleção pra saída/repasse) precisa mostrar
// pra decisão — pedido, CNPJ, destino e recurso(s) — sempre reaproveitando
// os mesmos dados já resolvidos aqui dentro (nfProcessada/cotação), nunca
// uma segunda consulta/lógica paralela. Quando um dado não é conhecido,
// fica ausente/null — a tela mostra "não informado", nunca adivinha.
function calcularAptidaoSaidaNota(nota) {
    const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    if (!normalize(nota.nf)) return { status: 'sem_nf', label: 'Sem número de NF — não é possível conferir', badge: 'neutro' };
    const nfNormalizada = normalize(nota.nf);

    // Se esta nota nasceu da pré-seleção do ERP, já sabemos o CNPJ — usa
    // isso pra achar a NF processada certa sem ambiguidade.
    const entradaVinculada = listaEntradasErp.find(e => e.notaVinculadaId === nota.id);
    const cnpjConhecido = entradaVinculada ? entradaVinculada.cnpjFornecedor : null;

    const candidatas = listaNfsProcessadas.filter(nf => normalize(nf.nf) === nfNormalizada && (!cnpjConhecido || nf.cnpjFornecedor === cnpjConhecido));

    if (candidatas.length === 0) {
        return { status: 'nao_conferida', label: 'Ainda não passou pela Entrada Segura (XML/NF)', badge: 'neutro', cnpjFornecedor: cnpjConhecido || null };
    }
    if (candidatas.length > 1) {
        return { status: 'ambigua', label: 'Mais de uma NF processada com este número — confira manualmente', badge: 'neutro' };
    }

    const nfProcessada = candidatas[0];
    const itensDiretos = (nfProcessada.itens || []).filter(it => it.semCotacao);
    const recursosDiretos = [...new Set(itensDiretos.map(it => it.recurso).filter(Boolean))];
    if (!nfProcessada.pedido && (nfProcessada.semCotacaoSmartCompras || itensDiretos.length)) {
        return { status: 'sem_cotacao', label: '✓ Conferida — compra direta, sem cotação do SmartCompras', badge: 'pronto', cnpjFornecedor: nfProcessada.cnpjFornecedor || null, destino: nfProcessada.destino || null, recursos: recursosDiretos };
    }
    if (!nfProcessada.pedido) {
        return { status: 'sem_pedido', label: 'Conferida, mas sem pedido/cotação vinculado', badge: 'neutro', cnpjFornecedor: nfProcessada.cnpjFornecedor || null };
    }

    const cotacao = listaCotacoes.find(c => c.pedido === nfProcessada.pedido);
    const codigosDestaNf = (nfProcessada.itens || []).map(it => it.codigoSmartCompras).filter(Boolean);
    const destino = cotacao ? (cotacao.origem || null) : null;
    const recursos = [...new Set([...(cotacao ? codigosDestaNf.map(cod => (cotacao.recursosPorItem || {})[cod]) : []), ...recursosDiretos].filter(Boolean))];
    const base = { pedido: nfProcessada.pedido, cnpjFornecedor: nfProcessada.cnpjFornecedor || null, destino, recursos };

    const divergenciasDestaNf = compararFontesPedido(nfProcessada.pedido)
        .filter(item => codigosDestaNf.includes(item.codProduto) && !item.resolvido)
        .flatMap(item => item.divergencias);

    if (divergenciasDestaNf.length === 0) {
        return { status: 'apta', label: '✓ Conferida — sem divergência com a cotação/ERP', badge: 'pronto', ...base };
    }

    // Há divergência — mas isso não é "não apta" por si só (o documento é
    // explícito: divergência pode só exigir registro). Só distingue se já
    // foi registrada em auditoria e se essa auditoria ainda está pendente.
    const anotacao = listaAnotacoes.find(a => a.pedido === nfProcessada.pedido);
    const temDivergenciaPendente = anotacao && (anotacao.ocorrencias || []).some(oc => (oc.divergencias || []).some(d => d.status === 'pendente'));

    if (temDivergenciaPendente) {
        return { status: 'auditoria_pendente', label: '⚠ Divergência registrada em auditoria, ainda pendente', badge: 'pendente', ...base };
    }
    if (anotacao) {
        return { status: 'divergencia_com_auditoria_resolvida', label: 'Divergência já registrada e resolvida em auditoria', badge: 'pronto', ...base };
    }
    return { status: 'divergencia_sem_auditoria', label: '⚠ Divergência com a cotação/ERP — ainda sem auditoria registrada', badge: 'pendente', ...base };
}

// Comparação Cotação × NF × ERP, só os itens deste fornecedor — embutida
// dentro do card do fornecedor na Central do Pedido (não é mais uma seção
// separada). Só aparece quando há algo relevante pra mostrar (item já
// faturado/lançado, ou item pendente de faturamento quando o pedido já tem
// alguma NF processada).
function renderComparacaoFornecedorHTML(pedido, cnpjFornecedor) {
    const itens = compararFontesPedido(pedido).filter(item => normalizarCnpj(item.cnpjFornecedor) === normalizarCnpj(cnpjFornecedor) && (item.temNf || item.temErp || item.divergencias.length));
    if (itens.length === 0) return '<div class="central-item-vazio">Nenhuma NF processada ainda pra este fornecedor neste pedido.</div>';
    const nfsDoFornecedor = [...new Set(itens.flatMap(item => item.nfs || []))];
    const cabecalhoNfs = nfsDoFornecedor.length
        ? `<div class="xml-item-acao"><span class="xml-item-meta">NF(s) por XML:</span> ${nfsDoFornecedor.map(n => `<button type="button" class="central-status-toggle" onclick="abrirNfDaDivergencia('${pedido}', '${escRel(String(n))}')">Abrir NF ${escRel(String(n))}</button>`).join(' ')}</div>` : '';
    return cabecalhoNfs + itens.map(item => renderComparacaoItemHTML(pedido, item, false)).join('');
}
// compacto = true: usado dentro da linha unificada do produto (o nome e o
// status já estão no cabeçalho da linha, então não se repetem).
// 2.0.6: todo item que tem NF (XML do app) ganha o link pra NF — não só os que têm divergência.
function htmlBotoesNfItem(pedido, item) {
    const nfs = (item.nfs || []).filter(n => n !== undefined && n !== null && String(n) !== '');
    if (!nfs.length) return '';
    return `<div class="xml-item-acao">${nfs.map(n => `<button type="button" class="central-status-toggle" onclick="abrirNfDaDivergencia('${pedido}', '${escRel(String(n))}')">Abrir NF ${escRel(String(n))}</button>`).join(' ')}</div>`;
}
function renderComparacaoItemHTML(pedido, item, compacto) {
    {
        const resolvido = !!(item.divergencias.length && item.resolvido);
        const statusHTML = resolvido
            ? `<span class="xml-item-badge pronto">✓ Resolvido</span>`
            : item.divergencias.length
            ? `<span class="xml-item-badge pendente">⚠ ${item.divergencias.length} diverg.</span>`
            : (!item.temNf && item.temErp) ? `<span class="xml-item-badge pronto">Lançado no ERP (sem NF)</span>`
            : `<span class="xml-item-badge pronto">✓ Confere</span>`;
        const fontesHTML = `Cotado: ${item.quantidadeCotada ?? '—'} · Faturado (NF): ${item.quantidadeFaturada ?? '—'} · Lançado (ERP): ${item.quantidadeLancada ?? '—'}`;
        return `<div class="xml-item-linha ${item.divergencias.length && !resolvido ? 'pendente' : ''}">
            ${compacto ? '' : `<div class="xml-item-topo">
                <div class="xml-produto-nome">${item.nome}</div>
                ${statusHTML}
            </div>`}
            <div class="xml-item-meta">${fontesHTML}</div>
            ${htmlBotoesNfItem(pedido, item)}
            ${item.divergencias.length ? `<div class="xml-item-cotacao">${item.divergencias.map(d => '• ' + textoDivergenciaNatural(d)).join('<br>')}</div>
            <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="registrarDivergenciaDaComparacao('${pedido}', '${item.codProduto}')">Gerar auditoria</button>${resolvido
                ? ` <button type="button" class="central-status-toggle" onclick="alterarResolvidoItemComparacao('${pedido}', '${item.codProduto}', false)">Reabrir</button> <span class="xml-item-meta">Resolvido em ${formatarDataBRSimples(item.resolvido.data)}</span>`
                : ` <button type="button" class="central-status-toggle" onclick="alterarResolvidoItemComparacao('${pedido}', '${item.codProduto}', true)">Marcar como resolvido</button>`}</div>` : ''}
        </div>`;
    }
}

// Fase 29 — auditoria retroativa a partir da Central: vincula uma entrada do
// ERP JÁ importada (histórico) a este pedido/fornecedor, reaproveitando o
// mesmo campo `vinculo` de entradasErp e a regra determinística da Fase 8
// (SP Data × SmartCompras só com UM item de mesma quantidade e valor).
let centralAssociarNfAberto = new Set();
let centralAssociarNfFiltro = {};
function entradasErpDoFornecedorCentral(cnpj) {
    // Fase 31: considera TODOS os CNPJs da mesma entidade do fornecedor (cadastro SP Data),
    // não só o CNPJ exato da cotação. Sem entidade cadastrada, vale só o CNPJ exato (como antes).
    const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpj);
    return listaEntradasErp.filter(e => {
        if (e.statusFluxo === 'pre_selecao') return false;
        const v = e.vinculo || {};
        return [e.cnpjFornecedor, v.cnpjFornecedor, ...(v.cnpjsFornecedor || [])].filter(Boolean).some(c => cnpjEmLista(entidade, c));
    });
}
function renderListaCandidatasAssociarNf(pedido, cnpj) {
    const filtro = normalizarCnpj(centralAssociarNfFiltro[normalizarCnpj(cnpj)] || '');
    const lista = entradasErpDoFornecedorCentral(cnpj)
        .filter(e => !(e.vinculo && e.vinculo.status === 'confirmado' && e.vinculo.pedido))
        .filter(e => !filtro || normalizarCnpj(e.nf).includes(filtro))
        .sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')));
    if (!lista.length) return '<div class="central-item-vazio">Nenhuma NF do histórico encontrada para este fornecedor' + (filtro ? ' com esse número' : '') + ' (CNPJs da mesma entidade incluídos).</div>';
    return lista.slice(0, 8).map(e => `<div class="central-item-linha" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>NF ${escRel(e.nf)}${e.serie ? '/' + escRel(e.serie) : ''} · ${escRel(e.data || '—')} · ${(e.itens || []).length} item(ns)</span>
        <button type="button" class="central-status-toggle" onclick="associarEntradaErpDaCentral('${e.id}', '${pedido}', '${cnpj}')">Associar</button>
    </div>`).join('') + (lista.length > 8 ? '<div class="central-item-vazio">Mostrando as 8 mais recentes — use o filtro pelo número da NF.</div>' : '');
}
function renderAssociarNfFornecedorHTML(pedido, cnpj) {
    const aberto = centralAssociarNfAberto.has(cnpj);
    const vinculadas = entradasErpDoFornecedorCentral(cnpj).filter(e => e.vinculo && e.vinculo.status === 'confirmado' && e.vinculo.pedido === pedido);
    const entidadeVinc = cnpjsDaMesmaEntidadeFornecedor(cnpj);
    const vinculadasHTML = vinculadas.map(e => `<div class="central-item-meta"><span>NF ${escRel(e.nf)}${e.serie ? '/' + escRel(e.serie) : ''} registrada no ERP e associada a este pedido · ${nfErpTemXmlNoApp(e, entidadeVinc) ? 'XML processado no app' : 'sem XML processado no app'}</span>${e.vinculo.viaCentral ? `<button type="button" class="central-status-toggle" onclick="desfazerAssociacaoEntradaErpDaCentral('${e.id}', '${pedido}')">Desfazer</button>` : ''}</div>`).join('');
    return `<div class="central-chegada"><button type="button" class="central-status-toggle" onclick="toggleAssociarNfCentral('${cnpj}')">${aberto ? 'Fechar' : (vinculadas.length ? 'Associar outra NF do histórico' : 'Associar NF do histórico')}</button></div>
        ${vinculadasHTML}
        ${aberto ? `<div class="central-item-detalhes">
            <input type="text" class="form-field" inputmode="numeric" placeholder="Número da NF (a lista filtra enquanto digita)" value="${escRel(centralAssociarNfFiltro[normalizarCnpj(cnpj)] || '')}" oninput="filtrarAssociarNfCentral('${pedido}', '${cnpj}', this.value)">
            <div id="assoc-nf-lista-${normalizarCnpj(cnpj)}">${renderListaCandidatasAssociarNf(pedido, cnpj)}</div>
        </div>` : ''}`;
}
function toggleAssociarNfCentral(cnpj) {
    if (centralAssociarNfAberto.has(cnpj)) centralAssociarNfAberto.delete(cnpj); else centralAssociarNfAberto.add(cnpj);
    renderCentralPedidoCompleto(centralPedidoAtual);
}
function filtrarAssociarNfCentral(pedido, cnpj, valor) {
    centralAssociarNfFiltro[normalizarCnpj(cnpj)] = valor;
    const el = document.getElementById('assoc-nf-lista-' + normalizarCnpj(cnpj));
    if (el) el.innerHTML = renderListaCandidatasAssociarNf(pedido, cnpj);
}
function associarEntradaErpDaCentral(chave, pedido, cnpj) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada || !pedido || !normalizarCnpj(cnpj)) return;
    showConfirmModal({
        title: 'Associar NF do histórico',
        message: `Vincular a NF ${entrada.nf} (ERP) ao pedido ${pedido}? Os itens que baterem exatamente em quantidade e valor com itens da cotação ainda sem SP Data serão associados automaticamente. Dá pra desfazer o vínculo depois; as associações de SP Data criadas continuam.`,
        confirmText: 'Associar',
        confirmClass: 'warning',
        onConfirm: async () => {
            const v = entrada.vinculo || {};
            const novoVinculo = {
                ...v, status: 'confirmado', pedido, cnpjFornecedor: cnpj,
                confirmadoManualmente: true, confirmadoEm: new Date().toISOString(), viaCentral: true,
                vinculoAnterior: { status: v.status || null, pedido: v.pedido || null, cnpjFornecedor: v.cnpjFornecedor || null, cnpjTopo: entrada.cnpjFornecedor || null }
            };
            try {
                await entradasErpCollection.doc(chave).update({ vinculo: novoVinculo, cnpjFornecedor: cnpj });
                entrada.vinculo = novoVinculo; entrada.cnpjFornecedor = cnpj;
                const resultado = reconciliarAssociacoesSpDataViaErp(entrada);
                for (const p of resultado.pares) await confirmarAssociacaoSpData(p.codigoSmartCompras, p.spDataCodigo, { silencioso: true, origemAutomatica: true });
                toast(`✓ NF ${entrada.nf} associada ao pedido ${pedido}` + (resultado.pares.length ? ` · ${resultado.pares.length} associação(ões) de SP Data preenchida(s).` : '.'));
                if (centralPedidoAtual === pedido) renderCentralPedidoCompleto(pedido);
            } catch (e) {
                console.error('Erro ao associar NF do histórico:', e);
                toast('✕ Erro ao associar. Tente novamente.');
            }
        }
    });
}
function desfazerAssociacaoEntradaErpDaCentral(chave, pedido) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada || !entrada.vinculo || !entrada.vinculo.viaCentral || !entrada.vinculo.vinculoAnterior) return;
    showConfirmModal({
        title: 'Desfazer associação',
        message: `Remover o vínculo da NF ${entrada.nf} com o pedido ${pedido}? As associações de SP Data já criadas não são removidas.`,
        confirmText: 'Desfazer',
        confirmClass: 'danger',
        onConfirm: async () => {
            const { viaCentral, vinculoAnterior: ant, confirmadoManualmente, confirmadoEm, ...resto } = entrada.vinculo;
            const restaurado = { ...resto, status: ant.status || 'sem_associacao', pedido: ant.pedido || null, cnpjFornecedor: ant.cnpjFornecedor || null };
            try {
                await entradasErpCollection.doc(chave).update({ vinculo: restaurado, cnpjFornecedor: ant.cnpjTopo || null });
                entrada.vinculo = restaurado; entrada.cnpjFornecedor = ant.cnpjTopo || null;
                toast('✓ Vínculo removido.');
                if (centralPedidoAtual === pedido) renderCentralPedidoCompleto(pedido);
            } catch (e) {
                console.error('Erro ao desfazer associação:', e);
                toast('✕ Erro ao desfazer. Tente novamente.');
            }
        }
    });
}

// Fase 28 — gravações pequenas dentro do próprio documento da cotação (mapas
// aninhados + merge, como recursosPorItem; sobrevivem à reimportação).
function dataLocalISO() { return new Date().toLocaleDateString('en-CA'); }
async function alterarResolvidoItemComparacao(pedido, codProduto, resolver) {
    const cot = listaCotacoes.find(c => c.pedido === pedido);
    if (!cot || !codProduto) return;
    try {
        const valor = resolver ? { data: dataLocalISO() } : firebase.firestore.FieldValue.delete();
        await cotacoesCollection.doc(pedido).set({ resolvidosPorItem: { [codProduto]: valor } }, { merge: true });
        const mapa = { ...(cot.resolvidosPorItem || {}) };
        if (resolver) mapa[codProduto] = valor; else delete mapa[codProduto];
        cot.resolvidosPorItem = mapa;
        toast(resolver ? '✓ Item marcado como resolvido.' : '✓ Item reaberto.');
        if (centralPedidoAtual === pedido) renderCentralPedidoCompleto(pedido);
    } catch (e) {
        console.error('Erro ao alterar resolvido do item:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}
async function alterarChegadaFornecedorCotacao(pedido, cnpj, chegou, tipo) {
    const cot = listaCotacoes.find(c => c.pedido === pedido);
    const chave = normalizarCnpj(cnpj);
    if (!cot) return;
    if (!chave) return toast('Este fornecedor não tem CNPJ na cotação: não dá pra marcar.');
    try {
        const valor = chegou ? { data: dataLocalISO(), ...(tipo ? { tipo } : {}) } : firebase.firestore.FieldValue.delete();
        await cotacoesCollection.doc(pedido).set({ chegadasPorFornecedor: { [chave]: valor } }, { merge: true });
        const mapa = { ...(cot.chegadasPorFornecedor || {}) };
        if (chegou) mapa[chave] = valor; else delete mapa[chave];
        cot.chegadasPorFornecedor = mapa;
        toast(chegou ? (tipo === 'parcial_resolvida' ? '✓ Entrega parcial marcada como resolvida.' : '✓ Fornecedor marcado como já chegou (manual).') : '✓ Marca manual removida.');
        if (centralPedidoAtual === pedido) renderCentralPedidoCompleto(pedido);
    } catch (e) {
        console.error('Erro ao alterar chegada do fornecedor:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// Mapa entre os tipos internos de compararFontesPedido e os tipos
// estruturados que JÁ EXISTEM em TIPOS_DIVERGENCIA_AUDITORIA — nunca cria um
// tipo novo, só liga o que os dois lados já têm. 'quantidade_nf_erp' (e 'valor_nf_erp', Fase 42) ficam
// de fora de propósito: é uma comparação NF×ERP, não cotado×faturado, e
// nenhum tipo estruturado atual descreve isso com precisão — forçar um
// rótulo errado seria pior do que deixar 'outro' com o texto natural, que é
// exatamente a situação em que o usuário deve escolher/reclassificar.
const MAPA_TIPO_DIVERGENCIA_COMPARACAO = {
    'nao_faturado': 'nao_faturado',
    'quantidade_cotada_nf': 'quantidade_diferente',
    'valor_cotado_nf': 'valor_diferente'
};

// Monta os campos do material estruturado a partir da divergência já
// calculada pela comparação — usa só o que a comparação já apurou
// (quantidade cotada/faturada, valor cotado/faturado), nunca inventa dado.
function camposMaterialDivergencia(tipoEstruturado, item, div) {
    const campos = { produto: item.nome };
    if (tipoEstruturado === 'nao_faturado') {
        campos.quantidade = div.quantidadeCotada;
    } else if (tipoEstruturado === 'quantidade_diferente') {
        campos.quantidadeCotada = div.quantidadeCotada;
        campos.quantidadeFaturada = div.quantidadeFaturada;
    } else if (tipoEstruturado === 'valor_diferente') {
        campos.quantidade = div.quantidadeFaturada != null ? div.quantidadeFaturada : div.quantidadeCotada;
        campos.valorCotado = div.valorCotado != null ? div.valorCotado.toFixed(2) : '';
        campos.valorFaturado = div.valorFaturado != null ? div.valorFaturado.toFixed(2) : '';
    }
    return campos;
}

// Abre a Nova Auditoria (já existente) já com pedido, fornecedor e a(s)
// divergência(s) pré-preenchida(s) — nunca grava sozinho, só prepara o
// rascunho; o usuário confere, ajusta se quiser, e salva como sempre fez.
//
// Ponto 1 desta atualização: cada divergência agora nasce com o TIPO
// ESTRUTURADO correto (NÃO FATURADO, QUANTIDADE DIFERENTE, VALOR DIFERENTE)
// sempre que a comparação já der evidência suficiente pra isso — nunca cai
// em "Outro" como padrão. Quando duas divergências de tipos diferentes
// existem no mesmo pedido, cada uma vira um card estruturado separado (nunca
// mistura tipos no mesmo card); quando o mesmo tipo se repete em itens
// diferentes, entram como materiais adicionais do MESMO card (é assim que a
// estrutura de "multiMaterial" já existente foi desenhada pra funcionar).
//
// Fase 10: se já existe um rascunho aberto pro MESMO pedido (usuário clicou
// "Gerar auditoria" em mais de um item divergente da mesma NF/pedido), a
// nova divergência é ACRESCENTADA ao rascunho em vez de abrirNovaAuditoria()
// resetar tudo. Só abre/limpa quando é de fato um pedido diferente do que já
// estava sendo preenchido.
function registrarDivergenciaDaComparacao(pedido, codProduto) {
    const item = compararFontesPedido(pedido, { nfExtra: nfExtraDaTela(pedido) }).find(i => i.codProduto === codProduto);
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!item || !cotacao) return;
    const fornecedor = (cotacao.fornecedores || []).find(f => mesmoCnpj(f.cnpj, item.cnpjFornecedor));

    const telaJaAberta = document.getElementById('screen-auditoria-nova').classList.contains('active');
    const mesmoPedidoNoRascunho = telaJaAberta && document.getElementById('aud-pedido').value.trim() === pedido;

    if (!mesmoPedidoNoRascunho) {
        abrirNovaAuditoria();
        document.getElementById('aud-pedido').value = pedido;
        buscarCotacaoParaAuditoria();
        if (fornecedor) document.getElementById('aud-fornecedor').value = nomeExibicaoFornecedor(fornecedor.razaoSocial, fornecedor.cnpj);
    }

    // NF: acumula números diferentes em vez de sobrescrever — o mesmo
    // pedido pode ter mais de uma NF, e a divergência de um item pode citar
    // uma NF diferente da do item anterior já preparado.
    if (item.nfs && item.nfs.length) {
        const campoNf = document.getElementById('aud-nf');
        const nfsAtuais = campoNf.value.split(',').map(s => s.trim()).filter(Boolean);
        campoNf.value = [...new Set([...nfsAtuais, ...item.nfs])].join(', ');
    }

    // Recurso do item (quando já confirmado na entrada da NF) — reaproveita
    // cotacao.recursosPorItem, nunca inventa nem pede de novo aqui.
    const recurso = (cotacao.recursosPorItem || {})[codProduto];
    let algumaMudanca = false;

    item.divergencias.forEach(div => {
        const tipoEstruturado = MAPA_TIPO_DIVERGENCIA_COMPARACAO[div.tipo];

        if (!tipoEstruturado) {
            // Sem tipo estruturado que bata de verdade com essa evidência —
            // fica em "Outro" com o texto natural, editável e reclassificável
            // manualmente. Isso não é usar "Outro" como padrão: é o caso
            // explícito em que não há categoria certa pra forçar.
            const textoDivergencia = textoDivergenciaNatural(div) + (recurso ? ` (Recurso: ${recurso})` : '');
            const jaExisteOutro = divergenciasAuditoria.some(d => d.tipo === 'outro' && d.campos && d.campos.produto === item.nome && d.observacao === textoDivergencia);
            if (!jaExisteOutro) {
                divergenciasAuditoria.forEach(d => d.aberto = false);
                divergenciasAuditoria.push({ id: ++contadorDivergenciaId, tipo: 'outro', aberto: true, materiais: [], observacao: textoDivergencia, campos: { produto: item.nome } });
                algumaMudanca = true;
            }
            return;
        }

        // Um card por tipo estruturado — acumula materiais, nunca mistura
        // tipos diferentes no mesmo card, nunca duplica o mesmo produto
        // dentro do mesmo tipo.
        const novosCampos = camposMaterialDivergencia(tipoEstruturado, item, div);
        let card = divergenciasAuditoria.find(d => d.tipo === tipoEstruturado);
        if (!card) {
            card = { id: ++contadorDivergenciaId, tipo: tipoEstruturado, aberto: true, materiais: [], observacao: '', campos: {} };
            divergenciasAuditoria.forEach(d => d.aberto = false);
            divergenciasAuditoria.push(card);
            algumaMudanca = true;
        }
        const materialExistente = card.materiais.find(m => m.campos.produto === item.nome);
        if (materialExistente) {
            Object.assign(materialExistente.campos, novosCampos);
        } else {
            card.materiais.push({ id: ++contadorMaterialId, campos: novosCampos });
            algumaMudanca = true;
        }
        const linhaRecurso = recurso ? `Recurso ${item.nome}: ${recurso}` : null;
        if (linhaRecurso && !card.observacao.includes(linhaRecurso)) {
            card.observacao = (card.observacao ? card.observacao + '\n' : '') + linhaRecurso;
        }
    });

    renderDivergenciasAuditoria();
    switchToScreen('screen-auditoria-nova', 'Nova Auditoria');
    toast(mesmoPedidoNoRascunho
        ? (algumaMudanca ? '✓ Divergência acrescentada ao rascunho, já classificada.' : 'Essa divergência já estava no rascunho.')
        : 'Divergência pré-preenchida e classificada a partir da comparação — confira e salve.');
}

// Extrai a aplicação de fator/unidade no DOM do XML em memória, separada de
// "salvar" e "baixar" — as duas ações precisam do XML corrigido, mas só
// Salvar grava o histórico (nfsProcessadas). Reaproveita os mesmos valores
// originais (qComOriginal etc.), então chamar de novo é seguro/idempotente.
function aplicarConversaoNoXmlDom() {
    const unidadeDestino = document.getElementById('xml-unidade-destino').value.trim() || 'UN';
    const excecoesParaSalvar = {};

    itensXmlDetectados.forEach(item => {
        const fator = item.fator;
        if (item.cProdNovo && item.cProdNovo !== item.cProd) {
            const cProdEl = item.prod.getElementsByTagName('cProd')[0];
            if (cProdEl) cProdEl.textContent = item.cProdNovo;
        }
        if (fator !== 1) {
            item.qComEl.textContent = (item.qComOriginal * fator).toFixed(4);
            item.vUnComEl.textContent = (item.vUnComOriginal / fator).toFixed(7);
            item.qTribEl.textContent = (item.qTribOriginal * fator).toFixed(4);
            item.vUnTribEl.textContent = (item.vUnTribOriginal / fator).toFixed(7);
            item.rastros.forEach(r => { r.qLoteEl.textContent = (r.qLoteOriginal * fator).toFixed(3); });
        }
        aplicarRastroDecididoNoXml(item); // Fase 43: lote/validade confirmados viram <rastro> (só os que você confirmou)
        // Salva a exceção quando o fator não é 1 (comportamento já existente)
        // OU quando o item começou suspeito e foi confirmado — mesmo que a
        // confirmação tenha mantido o fator em 1 (Caso A: "é 1:1 mesmo",
        // sem isso a próxima NF desse fornecedor/produto voltaria a pedir
        // confirmação de novo, o que contraria a reutilização do que já foi
        // conferido).
        if (fator !== 1 || item.suspeitoOriginal) {
            excecoesParaSalvar[item.chaveExcecao] = fator;
        }
        item.uComEl.textContent = unidadeDestino;
        item.uTribEl.textContent = unidadeDestino;
    });

    return excecoesParaSalvar;
}

async function salvarExcecoesConversao(excecoesParaSalvar) {
    try {
        await Promise.all(Object.entries(excecoesParaSalvar).map(([chave, fator]) =>
            xmlExcecoesCollection.doc(chave).set({ fator, atualizadoEm: new Date().toISOString() }, { merge: true })
        ));
    } catch (e) { console.error('Erro ao salvar exceções de XML:', e); }
}

// Gate de pendências, reaproveitado tanto por Salvar quanto por Baixar — não
// avança silenciosamente com pendência impeditiva, avisa exatamente o que
// falta. Uma NF já totalmente resolvida segue direto, sem burocracia extra.
// Fase 9: só bloqueia mesmo quando há BLOQUEIO real (ver
// calcularResumoPendenciasXml) — usado tanto por "Salvar NF" quanto por
// "Baixar XML", já que os dois gravam/derivam a partir dos mesmos dados
// (fator de conversão, código de saída).
function verificarBloqueioEAvisar() {
    const resumo = calcularResumoPendenciasXml();
    if (resumo && !resumo.podeSalvar) {
        showConfirmModal({
            title: 'NF ainda possui pendências que impedem continuar',
            message: `Esta NF tem ${resumo.bloqueios.length} pendência(s) que precisam ser resolvidas antes:\n${resumo.bloqueios.map(p => '• ' + p).join('\n')}\n\nToque numa pendência do checklist (ou abra a aba Itens/Pedido) para resolver antes de continuar.`,
            confirmText: 'Entendi',
            confirmClass: 'warning',
            onConfirm: () => {}
        });
        return false;
    }
    return true;
}

// "Salvar NF" é a ação principal que conclui o processamento — grava
// nfsProcessadas (o "lado NF" da comparação de 3 fontes) e as exceções de
// conversão, e mostra na hora se há divergência com a cotação/ERP. Baixar o
// XML fica como ação independente (ver baixarXmlConvertido), pra quando o
// arquivo realmente precisa ser gerado — não é mais obrigatório baixar só
// pra salvar o processamento.
//
// Fase 9: bloqueio real (ver verificarBloqueioEAvisar) impede continuar.
// Alerta (não-bloqueante) sempre pede confirmação explícita antes de
// salvar — nunca salva silenciosamente por trás de uma pendência que o
// usuário talvez não tenha notado, mas também nunca impede quem já
// decidiu que quer salvar assim mesmo e resolver o resto depois.
async function salvarEntradaNF() {
    if (!xmlDocAtual) return;
    if (!verificarBloqueioEAvisar()) return;
    const resumo = calcularResumoPendenciasXml();
    if (resumo && resumo.alertas.length > 0) {
        showConfirmModal({
            title: 'Salvar mesmo com alerta(s)?',
            message: `Esta NF tem ${resumo.alertas.length} alerta(s) que não impedem salvar, mas merecem atenção:\n${resumo.alertas.map(p => '• ' + p).join('\n')}\n\nPode ser resolvido depois. Deseja salvar assim mesmo?`,
            confirmText: 'Salvar assim mesmo',
            confirmClass: 'warning',
            onConfirm: () => confirmarAlteracoesEExecutar(executarSalvarEntradaNF)
        });
        return;
    }
    confirmarAlteracoesEExecutar(executarSalvarEntradaNF);
}

async function executarSalvarEntradaNF() {
    const excecoes = aplicarConversaoNoXmlDom();
    await salvarExcecoesConversao(excecoes);

    try {
        await salvarNfProcessada();
    } catch (e) {
        console.error('Erro ao salvar NF processada:', e);
        toast('✕ Erro ao salvar a NF. Tente novamente.');
        return;
    }

    // Cadastro automático por CNPJ (não bloqueia o salvamento da NF se falhar).
    if (nfeInfoAtual) await garantirFornecedorPorCnpjXml(nfeInfoAtual.cnpjEmit, nfeInfoAtual.fornecedor);

    const recursosAplicados = await aplicarRecursoPorCotacaoNf();
    nfSalvaXml = true;
    renderAssociacaoCotacaoXml();
    toast(recursosAplicados.length ? `✓ NF salva. Recurso gravado em ${recursosAplicados.length} item(ns) da cotação.` : '✓ NF salva.');
}

// Mostra, direto na Entrada de NF (sem trocar de tela), o resultado da
// comparação Cotação × NF × ERP só pros itens desta NF — reaproveita
// compararFontesPedido/textoDivergenciaNatural, os mesmos usados na Central
// do Pedido. "Gerar auditoria" só prepara o rascunho, nunca salva sozinho.
// Conferência Cotação × NF × ERP da NF em tratamento: recalculada na tela a
// cada mudança (fator, associação, pedido…), ANTES de salvar. Usa a NF em
// edição como se já estivesse salva, mas não grava nada. Itens com conversão
// ainda não confirmada não entram (evita falso alarme de quantidade).
function nfExtraDaTela(pedido) {
    if (!nfeInfoAtual || !pedidoSelecionadoXml || pedidoSelecionadoXml !== pedido) return null;
    const tela = document.getElementById('screen-xml-editor');
    if (!tela || !tela.classList.contains('active')) return null;
    const montada = montarNfProcessadaAtual({ soConfirmados: true });
    return montada ? { id: montada.chave, ...montada.doc } : null;
}

function renderResultadoSalvarNF() {
    const el = document.getElementById('xml-resultado-salvar');
    if (!el) return;
    if (!pedidoSelecionadoXml || !nfeInfoAtual) { el.style.display = 'none'; return; }

    const montada = montarNfProcessadaAtual({ soConfirmados: true });
    const nfExtra = montada ? { id: montada.chave, ...montada.doc } : null;
    const codigosConfirmados = itensXmlDetectados
        .filter(item => !item.semCotacao && !item.suspeito)
        .map(item => bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)])
        .filter(Boolean)
        .map(a => a.codigoSmartCompras);
    const aguardando = itensXmlDetectados.filter(item => !item.semCotacao && item.suspeito
        && bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)]).length;

    // Uma cotação (o normal) ou várias (NF com itens de mais de um pedido):
    // junta a conferência de cada pedido selecionado; cada resultado carrega
    // o próprio pedido pra "Gerar auditoria" abrir o pedido certo.
    const comparacao = cotacoesSelecionadasXml()
        .flatMap(p => compararFontesPedido(p, { nfExtra }).map(item => ({ ...item, _pedido: p })))
        .filter(item => codigosConfirmados.includes(item.codProduto));
    if (comparacao.length === 0 && aguardando === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';

    const temDivergencia = comparacao.some(item => item.divergencias.length > 0);
    const previa = nfSalvaXml ? '' : ' (prévia — ainda não salva)';
    const cabecalho = comparacao.length === 0 ? '' : `<div class="xml-estado-card ${temDivergencia ? 'pendente' : 'pronto'}"><div class="xml-estado-linha">${
        temDivergencia
            ? `<span class="xml-item-badge pendente">⚠ Divergência com a cotação/ERP${previa}</span>`
            : `<span class="xml-item-badge pronto">✓ Confere com a cotação/ERP${previa}</span>`
    }</div></div>`;
    const aguardandoHTML = aguardando > 0
        ? `<div class="xml-item-meta">${aguardando} item(ns) aguardando a confirmação do fator de conversão — só entram na conferência depois de confirmados.</div>` : '';

    const itensComDivergencia = comparacao.filter(item => item.divergencias.length > 0).map(item => `<div class="xml-item-linha pendente">
        <div class="xml-item-topo"><div class="xml-produto-nome">${item.nome}${multiPedidoAtivo() ? ` <span class="xml-item-meta">(Pedido ${escRel(item._pedido)})</span>` : ''}</div></div>
        <div class="xml-item-cotacao">${item.divergencias.map(d => '• ' + textoDivergenciaNatural(d)).join('<br>')}</div>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="registrarDivergenciaDaComparacao('${escRel(item._pedido)}', '${item.codProduto}')">Gerar auditoria</button>${item.divergencias.some(d => d.tipo === 'quantidade_cotada_nf' || d.tipo === 'valor_cotado_nf') ? ` <button type="button" class="central-status-toggle" onclick="marcarFalsoPositivoUnidade('${escRel(item.codigoSpData || '')}')">Falso positivo (unidade)</button>` : ''}</div>
    </div>`).join('');

    el.innerHTML = cabecalho + aguardandoHTML + itensComDivergencia;
}
function marcarFalsoPositivoUnidade(codigoSpData) {
    const produto = codigoSpData ? listaProdutosSpData.find(p => p.codigo === codigoSpData) : null;
    if (!produto) return toast('Associe este item ao SP Data primeiro — o aviso é sinalizado por produto SP Data.');
    if (!produto.ignorarDivergenciaUnidade) alternarIgnorarDivergenciaProdutoSpData(codigoSpData);
}
function multiPedidoAtivo() { return pedidosAdicionaisXml.length > 0; }

