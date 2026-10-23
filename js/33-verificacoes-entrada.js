// 33-verificacoes-entrada.js — Verificações na entrada (2.11.1)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Objetivo ("entrada segura"): no momento em que um XML ou um relatório do ERP entra, o app já cruza o que sabe e AVISA o que não fecha,
// em vez de a divergência aparecer só dias depois numa auditoria. Só avisa: nunca bloqueia, nunca altera dado.
// Cada verificação devolve { nivel: 'atencao' | 'info', texto }.

function dataISOSimples(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : ''; }
function numeroBrOuPonto(v) { const n = typeof v === 'number' ? v : valorNfNumerico(v); return Number.isFinite(n) ? n : null; }

// ---------------- XML (Entrada de NF) ----------------
function verificacoesNfXml() {
    const r = [];
    if (!nfeInfoAtual) return r;
    const info = nfeInfoAtual;

    // 1) Itens diferentes da NF ligados ao MESMO produto da cotação (as quantidades se somam na comparação)
    const porCod = new Map();
    itensXmlDetectados.forEach(it => {
        if (it.semCotacao) return;
        const a = bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(info.cnpjEmit, it.cProd)];
        if (!a || !a.codigoSmartCompras) return;
        if (!porCod.has(a.codigoSmartCompras)) porCod.set(a.codigoSmartCompras, []);
        porCod.get(a.codigoSmartCompras).push(it);
    });
    porCod.forEach((lista, cod) => {
        if (new Set(lista.map(i => String(i.cProd))).size < 2) return;
        r.push({ nivel: 'atencao', texto: `Itens diferentes ligados ao mesmo produto da cotação (código ${cod}): ${lista.map(i => String(i.xProd).slice(0, 40)).join(' + ')}. As quantidades serão somadas na comparação; confira se não é uma associação trocada.` });
    });

    // 2) Valor do XML × valor lançado no ERP para a MESMA NF
    const total = numeroBrOuPonto(info.valorTotal);
    const erp = listaEntradasErp.find(e => normNfNumero(e.nf) === normNfNumero(info.nNF) && (normSerieNf(e.serie) === normSerieNf(info.serie)) && (!e.cnpjFornecedor || mesmoCnpj(e.cnpjFornecedor, info.cnpjEmit) || mesmaRaizCnpj(e.cnpjFornecedor, info.cnpjEmit)));
    if (erp && total !== null) {
        const t = erp.financeiro && erp.financeiro.totalNota != null ? erp.financeiro.totalNota : numeroBrOuPonto(erp.valor);
        if (t != null && Math.abs(t - total) > 0.05) {
            const dif = total - t;
            const quando = [erp.data ? 'lançada em ' + erp.data : '', erp.vencimento ? 'vencimento ' + erp.vencimento : '', ROTULO_STATUS_ERP[erp.statusFluxo] || ''].filter(Boolean).join(' · ');
            r.push({ nivel: 'atencao', texto: `O valor desta NF no XML (R$ ${formatValorBR(total)}) é diferente do lançado no ERP (R$ ${formatValorBR(t)}) — o XML está R$ ${formatValorBR(Math.abs(dif))} ${dif > 0 ? 'acima' : 'abaixo'}. Lançamento do ERP: NF ${erp.nf}${erp.serie ? '/' + erp.serie : ''}${quando ? ' (' + quando + ')' : ''}. Pode ser frete, desconto ou imposto lançado de outro jeito; abra o lançamento para conferir.`, acao: { rotulo: 'Abrir lançamento do ERP', js: `abrirEditorNf('${String(erp.id).replace(/'/g, "\\'")}')` } });
        }
    }

    // 3) Fornecedor da NF não participa do pedido escolhido
    const cot = (!semCotacaoNfXml && pedidoSelecionadoXml) ? listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml) : null;
    if (cot && (cot.fornecedores || []).length) {
        const entidade = cnpjsDaMesmaEntidadeFornecedor(info.cnpjEmit);
        const participa = cot.fornecedores.some(f => mesmoCnpj(f.cnpj, info.cnpjEmit) || mesmaRaizCnpj(f.cnpj, info.cnpjEmit) || cnpjEmLista(entidade, f.cnpj));
        if (!participa) r.push({ nivel: 'atencao', texto: `O fornecedor desta NF não aparece entre os fornecedores do pedido ${cot.pedido}. Confira se o pedido está certo (ou se ele entregou por outro CNPJ).` });
    }

    // 3b) Item a item: valor unitário e quantidade × cotação, e quantidade × ERP (mesmas contas da conferência do pedido,
    //     só que agora, antes de salvar). O que for gravado é exatamente quantidade = qCom × fator e valor = vUn ÷ fator.
    r.push(...verificacoesItensXml(erp));

    // 4) Vencimento antes da emissão
    const em = dataISOSimples(info.emissao);
    const antes = (info.vencimentos || []).map(dataISOSimples).filter(v => v && em && v < em);
    if (antes.length) r.push({ nivel: 'atencao', texto: 'Há vencimento anterior à data de emissão da NF. Confira as datas no XML.' });

    // 5) Número da NF vazio ou valor zerado
    if (!info.nNF) r.push({ nivel: 'atencao', texto: 'O XML não traz o número da NF.' });
    if (total !== null && total <= 0) r.push({ nivel: 'atencao', texto: 'O valor total da NF está zerado.' });
    return r;
}

// ---------------- Relatório do ERP (prévia da importação) ----------------
function verificacoesNotaErp(nota) {
    const r = [];
    const total = numeroBrOuPonto(nota.valor);
    if (total !== null && total <= 0) r.push({ nivel: 'atencao', texto: 'Valor total da nota zerado no relatório.' });
    if (!(nota.itens || []).length) r.push({ nivel: 'atencao', texto: 'A nota não tem itens no relatório.' });

    // (vencimento × lançamento não é verificado: nota lançada com atraso tem vencimento anterior ao lançamento e isso é normal)

    // fornecedor do ERP sem CNPJ no cadastro SP Data: o app não consegue achar o pedido
    const docForn = nota.codigoFornecedorSpData ? listaFornecedoresSpData.find(f => String(f.codigo) === String(nota.codigoFornecedorSpData)) : null;
    const cnpjs = docForn ? (docForn.cnpjs || []).map(c => c.cnpj).filter(Boolean) : [];
    if (nota.codigoFornecedorSpData && !cnpjs.length) r.push({ nivel: 'info', texto: 'Este fornecedor ainda não tem CNPJ no cadastro SP Data: o app não conseguirá achar o pedido sozinho. Cadastre o CNPJ ou associe o pedido depois.' });

    // mesma NF já processada pelo XML, com valor diferente
    if (cnpjs.length && total !== null) {
        const nf = listaNfsProcessadas.find(n => normNfNumero(n.nf) === normNfNumero(nota.nf) && normSerieNf(n.serie) === normSerieNf(nota.serie) && cnpjs.some(c => mesmoCnpj(c, n.cnpjFornecedor)));
        const vx = nf ? numeroBrOuPonto(nf.valorTotal) : null;
        if (vx !== null && Math.abs(vx - total) > 0.05) r.push({ nivel: 'atencao', texto: `Esta NF já foi processada pelo XML com valor diferente (XML R$ ${formatValorBR(vx)} × ERP R$ ${formatValorBR(total)}).` });
    }

    // itens do ERP com código SP Data que não existe na lista de produtos
    if (listaProdutosSpData.length) {
        const sem = (nota.itens || []).filter(i => i.codigoSpData && !listaProdutosSpData.some(p => String(p.codigo) === String(i.codigoSpData)));
        if (sem.length) r.push({ nivel: 'info', texto: `${sem.length} item(ns) com código SP Data fora da lista de produtos (${sem.slice(0, 2).map(i => String(i.nome).slice(0, 30)).join(', ')}${sem.length > 2 ? '…' : ''}). Importe a lista de produtos atualizada.` });
    }
    return r;
}

// ---------------- apresentação ----------------
function htmlAlertasEntrada(lista) {
    if (!lista || !lista.length) return '';
    const atencao = lista.filter(x => x.nivel === 'atencao').length;
    return `<div class="card nfe-alerta entrada-alertas"><div class="nfe-alerta-tit">${atencao ? '⚠' : 'ℹ'} Verificações da entrada (${lista.length})</div>
        ${lista.map(x => `<div class="nfe-alerta-txt${x.nivel === 'info' ? ' entrada-info' : ''}">• ${escRel(x.texto)}${x.acao ? ` <button type="button" class="action-chip edit-chip" style="height:28px;padding:0 12px;margin-left:6px" onclick="${escRel(x.acao.js)}">${escRel(x.acao.rotulo)}</button>` : ''}</div>`).join('')}</div>`;
}

// Quantidade/valor de cada item da NF contra a cotação (e contra o ERP da mesma NF). Mesma regra da comparação do pedido.
function verificacoesItensXml(erp) {
    const r = [];
    if (!nfeInfoAtual || semCotacaoNfXml) return r;
    const pedidos = [pedidoSelecionadoXml, ...(typeof pedidosAdicionaisXml !== 'undefined' ? pedidosAdicionaisXml : [])].filter(Boolean);
    const cots = pedidos.map(p => listaCotacoes.find(c => c.pedido === p)).filter(Boolean);
    const nomeIt = i => String(i.xProd || i.cProd).split(' (')[0].slice(0, 38);
    const fmt = v => numeroLimpo(Number(v));

    // agrupa por produto da cotação (itens da NF que apontam para o mesmo código somam)
    const grupos = new Map();
    itensXmlDetectados.forEach(it => {
        if (it.semCotacao) return;
        const st = statusItemXml(it);
        const cod = st.associacao && st.associacao.codigoSmartCompras; if (!cod) return;
        if (!grupos.has(cod)) grupos.set(cod, { itens: [], st });
        grupos.get(cod).itens.push(it);
    });
    const cnpjNf = nfeInfoAtual.cnpjEmit;
    grupos.forEach((g, cod) => {
        if (g.st.produtoSpData && g.st.produtoSpData.ignorarDivergenciaUnidade) return; // produto sinalizado: unidades não comparáveis
        if (g.itens.some(i => !Number.isFinite(i.qComOriginal) || !Number.isFinite(i.vUnComOriginal))) return; // XML sem quantidade/valor legível
        const doCod = cots.flatMap(c => (c.itens || []).filter(i => i.codProduto === cod));
        if (!doCod.length) { if (cots.length) r.push({ nivel: 'info', texto: `${nomeIt(g.itens[0])}: o produto da cotação (código ${cod}) não está no pedido ${cots.map(c => c.pedido).join('/')}.` }); return; }
        const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpjNf);
        const cotItem = doCod.find(i => mesmoCnpj(i.cnpjFornecedor, cnpjNf) || cnpjEmLista(entidade, i.cnpjFornecedor)) || doCod[0];
        const nome = nomeIt(g.itens[0]);

        // valor unitário: bate direto ou convertido pelo fator (como na conferência do pedido)
        const cotado = parseFloat(cotItem.precoUnitario);
        if (Number.isFinite(cotado) && cotado > 0) {
            const ult = g.itens[g.itens.length - 1];
            const fator = ult.fator || 1;
            const valorUn = ult.vUnComOriginal / fator;
            const bate = Math.abs(cotado - valorUn) <= 0.005 || Math.abs(cotado - valorUn * fator) <= 0.005;
            if (!bate) {
                // mostra o valor na mesma unidade do cotado: a do XML ou a convertida pelo fator, a que mais se aproxima
                const v = Math.abs(valorUn - cotado) <= Math.abs(ult.vUnComOriginal - cotado) ? valorUn : ult.vUnComOriginal;
                const dif = ((v - cotado) / cotado) * 100;
                r.push({ nivel: 'atencao', texto: `${nome}: valor unitário do XML R$ ${formatValorBR(v)}${fator !== 1 ? ' (já com o fator ' + numeroLimpo(fator) + ')' : ''} × cotado R$ ${formatValorBR(cotado)} (${dif > 0 ? '+' : ''}${dif.toFixed(1).replace('.', ',')}%).` });
            }
        }

        // quantidade: soma desta NF + NFs já processadas do mesmo pedido (entrega em partes) × cotada
        const qCot = numeroFlexivel(cotItem.quantidade);
        if (qCot !== null) {
            const dir = g.itens.reduce((s, i) => s + i.qComOriginal * (i.fator || 1), 0);
            const conv = g.itens.reduce((s, i) => s + i.qComOriginal, 0);
            const ant = listaNfsProcessadas.filter(n => !(normNfNumero(n.nf) === normNfNumero(nfeInfoAtual.nNF) && normSerieNf(n.serie) === normSerieNf(nfeInfoAtual.serie) && mesmoCnpj(n.cnpjFornecedor, cnpjNf))
                && (pedidos.includes(n.pedido) || (n.pedidos || []).some(p => pedidos.includes(p))))
                .flatMap(n => (n.itens || []).filter(i => i.codigoSmartCompras === cod && (!i.pedidoItem || pedidos.includes(i.pedidoItem))));
            const antDir = ant.reduce((s, i) => s + i.quantidade, 0), antConv = ant.reduce((s, i) => s + i.quantidade / (i.fatorAplicado || 1), 0);
            const totDir = dir + antDir, totConv = conv + antConv;
            const bateDir = Math.abs(totDir - qCot) < 0.01, bateConv = Math.abs(totConv - qCot) < 0.01;
            if (!bateDir && !bateConv) {
                const total = Math.abs(totDir - qCot) <= Math.abs(totConv - qCot) ? totDir : totConv; // a conta (direta ou convertida) mais próxima do cotado
                const maior = total > qCot + 0.01;
                const parte = antConv ? ` (somando ${ant.length} lançamento(s) de NF já processada)` : '';
                if (maior) r.push({ nivel: 'atencao', texto: `${nome}: quantidade acima da cotada — NF ${fmt(total)}${parte} × cotado ${fmt(qCot)}.` });
                else r.push({ nivel: 'info', texto: `${nome}: entrega parcial — ${fmt(total)}${parte} de ${fmt(qCot)} cotados.` });
            }
        }
    });

    // quantidade no XML × quantidade lançada no ERP para a mesma NF, por produto SP Data
    if (erp && (erp.itens || []).length) {
        const porSp = new Map();
        itensXmlDetectados.forEach(it => {
            const st = statusItemXml(it); const sp = st.produtoSpData && st.produtoSpData.codigo; if (!sp) return;
            porSp.set(sp, (porSp.get(sp) || 0) + it.qComOriginal * (it.fator || 1));
        });
        porSp.forEach((qXml, sp) => {
            const linhas = (erp.itens || []).filter(i => String(i.codigoSpData) === String(sp));
            if (!linhas.length) return;
            const qErp = linhas.reduce((s, i) => s + i.quantidade, 0);
            if (Math.abs(qErp - qXml) > 0.01) {
                const prod = listaProdutosSpData.find(p => p.codigo === sp);
                r.push({ nivel: 'atencao', texto: `${String((prod && (prod.nome || prod.descricao)) || linhas[0].nome).slice(0, 38)}: quantidade no XML ${fmt(qXml)} × lançada no ERP ${fmt(qErp)}.` });
            }
        });
    }
    return r;
}
