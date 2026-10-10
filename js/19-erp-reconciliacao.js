// 19-erp-reconciliacao.js — Vínculo ERP/NF/cotação, reconciliação e pré-seleção (Fases 5 e 8)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- VÍNCULO ENTRADA ERP ↔ NF/XML ↔ COTAÇÃO (leitura, não cria associação) ---
// ===================================================================
// Cadeia: código do fornecedor (relatório ERP) → CNPJ(s) cadastrados
// (fornecedoresSpData) → bate com o cnpjFornecedor de uma associação
// fornecedor→item já confirmada (associacoesFornecedor) → mesma NF+? (usa o
// nfNumero gravado nessa associação) → o codigoSmartCompras dessa associação
// aponta pro item da cotação → a cotação que contém esse item é o pedido.
//
// Só confirma quando a NF do relatório ERP bate com o nfNumero já registrado
// em alguma associação cujo CNPJ está entre os cadastrados pro código do
// fornecedor do relatório. Nunca escolhe um CNPJ quando há mais de um: basta
// UM deles bater com uma associação existente pra confirmar; se nenhum bater
// (ou não houver associação pra nenhum deles), fica pendente — nunca grava
// vínculo assumido.
// Converte um número que pode vir em dois formatos diferentes já presentes
// no app: formato BR de relatório impresso ("1.234,56", usado pelo ERP — ver
// parseValorBR) ou texto simples com ponto decimal, tal como o XML do
// SmartCompras grava em Quantidade/Preco_Unitario/Preco_Total (ver
// parseXmlSmartCompras). Nunca inventa separador: decide pela presença de
// vírgula decimal.
function numeroFlexivel(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    const n = /,\d{1,4}\s*$/.test(s) ? parseValorBR(s) : parseFloat(s);
    return isNaN(n) ? null : n;
}

// Soma o valor total cotado (Preco_Total, com fallback pra
// Quantidade × Preco_Unitario quando Preco_Total vier vazio) dos itens de um
// fornecedor específico dentro de uma cotação — usado só como EVIDÊNCIA de
// reconciliação (Fase 8), nunca como fonte de verdade do valor da cotação.
function valorTotalCotacaoPorFornecedor(cotacao, cnpj) {
    return (cotacao.itens || [])
        .filter(it => mesmoCnpj(it.cnpjFornecedor, cnpj))
        .reduce((soma, it) => {
            const total = numeroFlexivel(it.precoTotal);
            if (total !== null) return soma + total;
            const qtd = numeroFlexivel(it.quantidade);
            const unit = numeroFlexivel(it.precoUnitario);
            return soma + (qtd !== null && unit !== null ? qtd * unit : 0);
        }, 0);
}

// Tolerância pra considerar o valor total do ERP "compatível" com o valor
// cotado de um fornecedor dentro de um pedido — evidência de reconciliação,
// nunca decide sozinha (sempre combinada com CNPJ, nunca com data isolada).
// 5% cobre frete/desconto/ajustes comuns entre cotação e nota fiscal real
// sem abrir demais pra falsos positivos.
const TOLERANCIA_VALOR_RECONCILIACAO_ERP = 0.05;

// ===================================================================
// --- FASE 8: RECONCILIAÇÃO ERP → NF/PEDIDO (CONFIRMADA/SUGERIDA/SEM) ---
// ===================================================================
// Três estados, sempre determinísticos e auditáveis (nunca fuzzy matching,
// nunca IA, nunca "mesma data = mesmo pedido" isolada):
//
// 'confirmado'      — já existe uma NF/XML processada (associacoesFornecedor)
//                      pro mesmo número de NF + CNPJ cadastrado. Igual à
//                      lógica original, preservada sem alteração de critério.
// 'sugerido'        — não há XML processado pra esta NF ainda, mas o CNPJ do
//                      fornecedor (cadastro oficial, nunca por nome) bate com
//                      o fornecedor de um ou mais pedidos, E o valor total
//                      cotado pra esse fornecedor nesse pedido é compatível
//                      (dentro da tolerância) com o valor total da NF do ERP.
//                      Sempre lista as evidências usadas e, quando mais de
//                      um pedido bate, todos os candidatos — nunca escolhe
//                      um sozinho.
// 'sem_associacao'  — sem CNPJ cadastrado, sem pedido do fornecedor, ou CNPJ
//                      bate mas nenhum pedido tem valor compatível.
function vincularEntradaErpComNf(bloco) {
    const cnpjsFornecedor = resolverCnpjsFornecedorSpData(bloco.codigoFornecedorSpData);

    if (cnpjsFornecedor.length === 0) {
        return { status: 'sem_associacao', motivo: 'Código de fornecedor sem CNPJ cadastrado no SP Data (ou cadastro ainda não importado).', evidencias: [], cnpjsFornecedor: [], cnpjFornecedor: null, pedido: null, candidatos: [] };
    }

    const associacoesCorrespondentes = Object.values(bancoAssociacoesFornecedor)
        .filter(a => a.nfNumero === bloco.nf && cnpjsFornecedor.includes(a.cnpjFornecedor));

    if (associacoesCorrespondentes.length > 0) {
        // Todas as associações correspondentes devem concordar no mesmo CNPJ —
        // se não concordarem (situação anômala), não decide sozinho.
        const cnpjsBatidos = [...new Set(associacoesCorrespondentes.map(a => a.cnpjFornecedor))];
        if (cnpjsBatidos.length > 1) {
            return { status: 'sem_associacao', motivo: 'Mais de um CNPJ cadastrado para este fornecedor bate com esta NF — ambíguo, precisa de confirmação manual.', evidencias: [], cnpjsFornecedor, cnpjFornecedor: null, pedido: null, candidatos: [] };
        }

        // Localiza a cotação/pedido a partir do(s) item(ns) já confirmados.
        const codigosSmartCompras = [...new Set(associacoesCorrespondentes.map(a => a.codigoSmartCompras))];
        let pedido = null;
        for (const cotacao of listaCotacoes) {
            if ((cotacao.itens || []).some(it => codigosSmartCompras.includes(it.codProduto))) { pedido = cotacao.pedido; break; }
        }

        return {
            status: 'confirmado',
            motivo: '',
            evidencias: ['NF/XML já processada e associada a este fornecedor e a este número de NF.'],
            cnpjsFornecedor,
            cnpjFornecedor: cnpjsBatidos[0],
            pedido,
            candidatos: []
        };
    }

    // Sem XML já processado pra esta NF — tenta reconciliar por evidência:
    // CNPJ do fornecedor (cadastro oficial) + valor total compatível com
    // algum pedido desse mesmo fornecedor. Nunca usa só data.
    const valorErp = parseValorBR(bloco.valor);
    const candidatos = [];
    listaCotacoes.forEach(cotacao => {
        const fornecedorMatch = (cotacao.fornecedores || []).find(f => cnpjEmLista(cnpjsFornecedor, f.cnpj));
        if (!fornecedorMatch) return;
        const valorCotado = valorTotalCotacaoPorFornecedor(cotacao, fornecedorMatch.cnpj);
        const diff = Math.abs(valorCotado - valorErp);
        const diffPercentual = valorCotado > 0 ? diff / valorCotado : null;
        const valorCompativel = valorCotado > 0 && diffPercentual !== null && diffPercentual <= TOLERANCIA_VALOR_RECONCILIACAO_ERP;
        const dataDentroPeriodo = !!(bloco.data && cotacao.dataPedido && cotacao.dataLimite &&
            converterDataBRparaISO(bloco.data) >= cotacao.dataPedido && converterDataBRparaISO(bloco.data) <= cotacao.dataLimite);
        candidatos.push({
            pedido: cotacao.pedido, cnpjFornecedor: fornecedorMatch.cnpj,
            valorCotado, valorErp, diffPercentual, valorCompativel, dataDentroPeriodo
        });
    });

    const compativeis = candidatos.filter(c => c.valorCompativel);
    if (compativeis.length > 0) {
        compativeis.sort((a, b) => a.diffPercentual - b.diffPercentual);
        const evidenciasBase = (c) => {
            const ev = [
                `CNPJ do fornecedor cadastrado bate com o pedido ${c.pedido}.`,
                `Valor compatível: cotado R$ ${formatValorBR(c.valorCotado)} × NF do ERP R$ ${formatValorBR(c.valorErp)} (diferença ${(c.diffPercentual * 100).toFixed(1)}%).`
            ];
            if (c.dataDentroPeriodo) ev.push('Data da NF dentro do período do pedido (evidência complementar — nunca usada isoladamente).');
            return ev;
        };
        return {
            status: 'sugerido',
            motivo: compativeis.length > 1 ? `${compativeis.length} pedido(s) do mesmo fornecedor com valor compatível — escolha manualmente.` : 'Evidências suficientes para sugerir, mas sem NF/XML processada confirmando — requer confirmação humana.',
            evidencias: evidenciasBase(compativeis[0]),
            cnpjsFornecedor,
            cnpjFornecedor: compativeis[0].cnpjFornecedor,
            pedido: compativeis.length === 1 ? compativeis[0].pedido : null,
            candidatos: compativeis.map(c => ({ pedido: c.pedido, evidencias: evidenciasBase(c) }))
        };
    }

    if (candidatos.length > 0) {
        return {
            status: 'sem_associacao',
            motivo: `Fornecedor cadastrado tem ${candidatos.length} pedido(s), mas nenhum com valor total compatível com esta NF do ERP (R$ ${formatValorBR(valorErp)}).`,
            evidencias: [],
            cnpjsFornecedor,
            cnpjFornecedor: candidatos[0].cnpjFornecedor,
            pedido: null,
            candidatos: []
        };
    }

    return {
        status: 'sem_associacao',
        motivo: 'Nenhum pedido/cotação cadastrado para este fornecedor (CNPJ oficial) ainda.',
        evidencias: [],
        cnpjsFornecedor,
        cnpjFornecedor: null,
        pedido: null,
        candidatos: []
    };
}

// Permite ao usuário confirmar manualmente um vínculo 'sugerido' (ou escolher
// entre candidatos empatados) — nunca automático. Preserva o registro
// original (evidências, motivo) e só substitui o status/pedido. Reaproveita
// o mesmo doc de entradasErp, nunca cria uma segunda estrutura.
async function confirmarVinculoErpComPedido(chave, pedidoEscolhido) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada || !pedidoEscolhido) return;
    try {
        const novoVinculo = { ...entrada.vinculo, status: 'confirmado', pedido: pedidoEscolhido, confirmadoManualmente: true, confirmadoEm: new Date().toISOString() };
        await entradasErpCollection.doc(chave).update({ vinculo: novoVinculo });
        toast(`✓ Vínculo confirmado com o pedido ${pedidoEscolhido}.`);
        // Agora que o pedido é certeza, tenta preencher automaticamente as
        // associações de SP Data que ainda faltarem nesse fornecedor/pedido
        // (ver reconciliarAssociacoesSpDataViaErp) — mesma regra determinística
        // usada na importação, nunca decide em caso de ambiguidade.
        const resultado = reconciliarAssociacoesSpDataViaErp({ ...entrada, vinculo: novoVinculo });
        if (resultado.pares.length) {
            for (const p of resultado.pares) await confirmarAssociacaoSpData(p.codigoSmartCompras, p.spDataCodigo, { silencioso: true, origemAutomatica: true });
            toast(`✓ Vínculo confirmado · ${resultado.pares.length} associação(ões) de SP Data preenchida(s) automaticamente a partir do ERP.`);
        }
        renderHistoricoNfs();
    } catch (e) {
        console.error('Erro ao confirmar vínculo ERP → pedido:', e);
        toast('✕ Erro ao confirmar vínculo.');
    }
}

// ===================================================================
// --- FASE 8: PREENCHIMENTO AUTOMÁTICO DE ASSOCIAÇÃO SP DATA VIA ERP ---
// ===================================================================
// Só atua quando o vínculo NF↔pedido já é uma CERTEZA (status 'confirmado' —
// seja pela associação de XML já existente, seja por confirmação manual de
// uma sugestão) — nunca a partir de uma sugestão ainda não confirmada.
// Casa item da cotação (sem associação SP Data ainda) com item do ERP
// (que já traz o código SP Data direto) pela QUANTIDADE e VALOR UNITÁRIO —
// dados concretos da mesma nota fiscal, nunca por semelhança de nome/texto.
// Só associa quando existe exatamente UM item do ERP compatível: ambiguidade
// nunca decide sozinha, fica como estava (associação manual, já existente).
function reconciliarAssociacoesSpDataViaErp(entrada) {
    if (!entrada || !entrada.vinculo || entrada.vinculo.status !== 'confirmado' || !entrada.vinculo.pedido) return { pares: [] };
    const cotacao = listaCotacoes.find(c => c.pedido === entrada.vinculo.pedido);
    if (!cotacao) return { pares: [] };
    const cnpj = entrada.vinculo.cnpjFornecedor;

    const itensCotacaoSemAssociacao = (cotacao.itens || []).filter(it =>
        mesmoCnpj(it.cnpjFornecedor, cnpj) && it.codProduto &&
        !listaAssociacoesSpData.some(a => a.codigoSmartCompras === it.codProduto)
    );
    if (!itensCotacaoSemAssociacao.length) return { pares: [] };

    const itensErp = entrada.itens || [];
    const usados = new Set();
    const pares = [];

    itensCotacaoSemAssociacao.forEach(itCot => {
        const qtdCot = numeroFlexivel(itCot.quantidade);
        const precoCot = numeroFlexivel(itCot.precoUnitario);
        if (qtdCot === null || precoCot === null) return;
        const candidatosIdx = itensErp.reduce((acc, itErp, idx) => {
            if (usados.has(idx)) return acc;
            if (Math.abs(itErp.quantidade - qtdCot) < 0.001 && Math.abs(itErp.valorUnitario - precoCot) < 0.01) acc.push(idx);
            return acc;
        }, []);
        if (candidatosIdx.length === 1) {
            usados.add(candidatosIdx[0]);
            pares.push({ codigoSmartCompras: itCot.codProduto, spDataCodigo: itensErp[candidatosIdx[0]].codigoSpData });
        }
    });

    return { pares };
}

// Cruza cada item do bloco ERP (código SP Data) com associacoesSpData, só
// quando já existe uma associação confirmada item da cotação → SP Data.
// Não sobrescreve o item original — devolve uma cópia com um campo extra.
function enriquecerItensEntradaErp(itens) {
    return itens.map(item => {
        const associacao = listaAssociacoesSpData.find(a => a.spDataCodigo === item.codigoSpData && !ehChaveDiretaSpData(a.codigoSmartCompras));
        return { ...item, codigoSmartComprasRelacionado: associacao ? associacao.codigoSmartCompras : null };
    });
}

async function salvarEntradasErp(blocosParsed) {
    if (!blocosParsed || !blocosParsed.length) return { salvos: 0, erros: 0, associacoesSpDataAutomaticas: 0 };
    const agora = new Date().toISOString();
    // Mapa dos docs já existentes — usado só pra decidir o statusFluxo (ver
    // resolverStatusFluxoEntradaErp), que precisa ser "grudento" em
    // reimportação: uma entrada já arquivada não deve voltar a pedir decisão.
    const existentesMap = {};
    listaEntradasErp.forEach(e => { existentesMap[e.id] = e; });
    // Acumula pares candidatos à associação automática de SP Data (Fase 8)
    // durante o parse dos blocos — só é aplicado DEPOIS que o batch de
    // entradasErp confirmar commit, e nunca duas vezes pro mesmo item da
    // cotação dentro da mesma importação (evita conflito se duas NFs desta
    // mesma leva, por algum motivo, parecessem bater com o mesmo item).
    const paresAutoAssociacao = [];
    const codigosSmartComprasJaEnfileirados = new Set();
    let salvos = 0, erros = 0;
    for (let i = 0; i < blocosParsed.length; i += 400) {
        const lote = blocosParsed.slice(i, i + 400);
        const batch = firestore.batch();
        lote.forEach(bloco => {
            if (!bloco.nf) { erros++; return; }
            const chave = chaveEntradaErp(bloco);
            const vinculo = vincularEntradaErpComNf(bloco);
            const fluxo = resolverStatusFluxoEntradaErp(bloco, vinculo, existentesMap[chave]);
            const itensEnriquecidos = enriquecerItensEntradaErp(bloco.itens);
            batch.set(entradasErpCollection.doc(chave), {
                nf: bloco.nf,
                serie: bloco.serie,
                documento: bloco.documento,
                codigoFornecedorSpData: bloco.codigoFornecedorSpData,
                fornecedorNomeRelatorio: bloco.fornecedor,
                cnpjFornecedor: vinculo.cnpjFornecedor, // null até confirmado — nunca escolhido arbitrariamente
                data: bloco.data,
                vencimento: bloco.vencimento,
                valor: bloco.valor, // Fase 38: pra pré-preencher "Enviar para a relação" no Controle de NFs
                itens: itensEnriquecidos,
                financeiro: bloco.financeiro,
                parcelas: bloco.parcelasDetalhe,
                avisos: bloco.avisos,
                vinculo, // {status: 'confirmado'|'sugerido'|'sem_associacao', motivo, evidencias, cnpjsFornecedor, cnpjFornecedor, pedido?, candidatos?} — referência, não altera nada original
                statusFluxo: fluxo.statusFluxo,
                notaVinculadaId: fluxo.notaVinculadaId,
                avisoJaExisteNotaManual: fluxo.avisoJaExisteNotaManual,
                marcadaDireta: fluxo.marcadaDireta || false,           // Fase 38: "não vai ao financeiro" marcada numa NF
                bloqueioFornecedor: fluxo.bloqueioFornecedor || false, // Fase 38: foi pro histórico por fornecedor ignorado
                atualizadoEm: agora
            });
            salvos++;

            // Fase 8: só tenta preencher associação de SP Data quando o
            // vínculo já saiu 'confirmado' nesta própria importação (NF/XML
            // já processada) — uma sugestão nunca alimenta isso sozinha.
            if (vinculo.status === 'confirmado' && vinculo.pedido) {
                const { pares } = reconciliarAssociacoesSpDataViaErp({ vinculo, itens: itensEnriquecidos });
                pares.forEach(p => {
                    if (!codigosSmartComprasJaEnfileirados.has(p.codigoSmartCompras)) {
                        codigosSmartComprasJaEnfileirados.add(p.codigoSmartCompras);
                        paresAutoAssociacao.push(p);
                    }
                });
            }
        });
        try {
            await batch.commit();
        } catch (e) {
            console.error('Erro ao salvar lote de entradasErp:', e);
            erros += lote.length;
            salvos -= lote.length;
        }
    }

    let associacoesSpDataAutomaticas = 0;
    for (const par of paresAutoAssociacao) {
        try {
            await confirmarAssociacaoSpData(par.codigoSmartCompras, par.spDataCodigo, { silencioso: true, origemAutomatica: true });
            associacoesSpDataAutomaticas++;
        } catch (e) {
            console.error('Erro ao aplicar associação automática de SP Data via ERP:', e);
        }
    }

    return { salvos, erros, associacoesSpDataAutomaticas };
}

// ===== Fase 5 — pré-seleção / bloqueio / financeiro (entradas do ERP) =====
// Incorporado do Agente 1: decide se uma entrada do relatório ERP fica em
// pré-seleção aguardando decisão manual, vai direto pro histórico (fornecedor
// bloqueado por CNPJ) ou já reconhece que foi arquivada manualmente antes.
// "Grudento" em reimportação: se já existe um doc e ele já saiu da
// pré-seleção (foi selecionado, arquivado, ou já foi direto pro histórico),
// o novo import NUNCA reseta isso sozinho — evita o cenário de uma NF já
// arquivada aparecer de novo como se precisasse de uma nova decisão.
function resolverStatusFluxoEntradaErp(bloco, vinculo, docExistente) {
    if (docExistente && docExistente.statusFluxo && docExistente.statusFluxo !== 'pre_selecao') {
        return {
            statusFluxo: docExistente.statusFluxo,
            notaVinculadaId: docExistente.notaVinculadaId || null,
            avisoJaExisteNotaManual: docExistente.avisoJaExisteNotaManual || false,
            marcadaDireta: docExistente.marcadaDireta || false,
            bloqueioFornecedor: docExistente.bloqueioFornecedor || false
        };
    }

    const cnpjsPossiveis = vinculo.cnpjFornecedor
        ? [vinculo.cnpjFornecedor]
        : (vinculo.cnpjsFornecedor && vinculo.cnpjsFornecedor.length ? vinculo.cnpjsFornecedor : resolverCnpjsFornecedorSpData(bloco.codigoFornecedorSpData));

    if (cnpjsPossiveis.some(c => fornecedoresIgnoradosCnpj.has(c))) {
        return { statusFluxo: 'historico_direto', notaVinculadaId: null, avisoJaExisteNotaManual: false, bloqueioFornecedor: true };
    }
    // Fase 38: NF só de XML que já foi marcada como "não vai ao financeiro" — a entrada do ERP herda a marca.
    const nfXmlMarcada = listaNfsProcessadas.find(n => n.semFinanceiro && n.nf === bloco.nf && (n.serie || '') === (bloco.serie || ''));
    if (nfXmlMarcada) return { statusFluxo: 'historico_direto', notaVinculadaId: null, avisoJaExisteNotaManual: false, marcadaDireta: true };

    // Reaproveita a checagem de duplicidade já existente (fluxo manual de
    // Adicionar Nota) — pelo nome do fornecedor tal como veio no relatório
    // ERP, já que é isso que o cadastro manual também usa.
    const duplicata = verificarDuplicidade(bloco.fornecedor, bloco.nf, bloco.valor); // Fase 41: também por nº + valor
    if (duplicata && duplicata.origem === 'historico') {
        // A mesma NF já foi processada e arquivada manualmente antes — não
        // cria um segundo registro pedindo decisão de novo, só reconhece que
        // já foi pro financeiro.
        return { statusFluxo: 'arquivada', notaVinculadaId: null, avisoJaExisteNotaManual: true };
    }
    if (duplicata && duplicata.origem === 'pendente') {
        // Ainda está sendo tratada manualmente — fica em pré-seleção, mas
        // sinaliza pro usuário não duplicar o trabalho.
        return { statusFluxo: 'pre_selecao', notaVinculadaId: null, avisoJaExisteNotaManual: true };
    }

    return { statusFluxo: 'pre_selecao', notaVinculadaId: null, avisoJaExisteNotaManual: false };
}

async function alternarBloqueioFornecedorCnpj(chave) {
    const grupo = listaFornecedoresUnificada().find(f => f.chave === chave);
    if (!grupo || !grupo.cnpjs.length) return toast('Cadastre pelo menos um CNPJ pra este fornecedor antes de bloquear.');
    const algumBloqueado = grupo.cnpjs.some(c => fornecedoresIgnoradosCnpj.has(c.cnpj));
    const novoConjunto = new Set(fornecedoresIgnoradosCnpj);
    grupo.cnpjs.forEach(c => { if (algumBloqueado) novoConjunto.delete(c.cnpj); else novoConjunto.add(c.cnpj); });
    try {
        await settingsDocRef.set({ fornecedoresIgnoradosCnpj: Array.from(novoConjunto) }, { merge: true });
        // Fase 38: vale também para as NFs deste fornecedor que já estavam esperando decisão (e desfaz só o que o bloqueio fez).
        try {
            const cnpjsGrupo = grupo.cnpjs.map(c => c.cnpj);
            const batchB = firestore.batch(); let nAtualizadas = 0;
            listaEntradasErp.forEach(e => {
                const v = e.vinculo || {};
                const doGrupo = [e.cnpjFornecedor, v.cnpjFornecedor, ...(v.cnpjsFornecedor || [])].filter(Boolean).some(c => cnpjsGrupo.some(g => mesmoCnpj(g, c)));
                if (!doGrupo) return;
                if (!algumBloqueado && e.statusFluxo === 'pre_selecao') { batchB.update(entradasErpCollection.doc(e.id), { statusFluxo: 'historico_direto', bloqueioFornecedor: true }); nAtualizadas++; }
                if (algumBloqueado && e.statusFluxo === 'historico_direto' && e.bloqueioFornecedor) { batchB.update(entradasErpCollection.doc(e.id), { statusFluxo: 'pre_selecao', bloqueioFornecedor: false }); nAtualizadas++; }
            });
            if (nAtualizadas) await batchB.commit();
        } catch (errB) { console.error('Erro ao reclassificar NFs do fornecedor bloqueado:', errB); }
        toast(algumBloqueado ? '✓ Fornecedor liberado — NFs do relatório ERP voltam a ser tratadas normalmente.' : '✓ Fornecedor bloqueado — NFs do relatório ERP vão direto pro Histórico.');
    } catch (e) {
        console.error('Erro ao alternar bloqueio de fornecedor:', e);
        toast('✕ Erro ao salvar.');
    }
}

// Reabrir uma entrada já arquivada (ou que foi direto pro histórico) — nunca
// silencioso: sempre confirma antes, porque "arquivada" tem um significado
// físico concreto (já foi pro financeiro) que não deve ser desfeito sem
// querer. Reabrir não cria um segundo registro — volta a trabalhar no mesmo
// doc, só muda o status de volta pra pré-seleção. Usada no card expandido da
// NF de origem ERP no Histórico novo (ver renderCardHistoricoNf).
function abrirEntradaErpComConfirmacao(chave, callback) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada) return;
    if (entrada.statusFluxo !== 'arquivada' && entrada.statusFluxo !== 'historico_direto') { callback(); return; }
    showConfirmModal({
        title: 'NF já está arquivada',
        message: `Esta NF (${entrada.nf}) já está arquivada — já foi tratada como concluída. Deseja desarquivar temporariamente pra trabalhar com ela de novo? O registro não é duplicado, você volta a editar o mesmo.`,
        confirmText: 'Desarquivar temporariamente',
        confirmClass: 'warning',
        onConfirm: async () => {
            try {
                await entradasErpCollection.doc(chave).update({ statusFluxo: 'pre_selecao', notaVinculadaId: null });
                toast('✓ NF desarquivada — importe o relatório de novo e marque a NF pra levá-la de volta ao Gerenciar NF.');
                callback();
            } catch (e) {
                console.error('Erro ao desarquivar entrada do ERP:', e);
                toast('✕ Erro ao desarquivar.');
            }
        }
    });
}
// ===== fim Fase 5 =====

async function colarRelatorioImportacao() {
    const textarea = document.getElementById('import-textarea');
    try {
        const texto = await navigator.clipboard.readText();
        textarea.value = texto;
        toast('Texto colado!');
    } catch (err) {
        toast('Permissão negada ou não suportada. Cole manualmente (Ctrl+V).');
    }
}

// Lê o arquivo TXT enviado pelo usuário. Relatórios desse tipo de ERP costumam
// vir salvos em ISO-8859-1/Windows-1252 (por causa de acentos), então
// detectamos automaticamente: tentamos ler como UTF-8 primeiro e, se aparecer
// muito caractere de substituição (sinal de acentuação quebrada), lemos de
// novo como ISO-8859-1.
function decodificarArquivoTexto(buffer) {
    const bytes = new Uint8Array(buffer);
    let textoUtf8 = '';
    try {
        textoUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (e) {
        textoUtf8 = '';
    }
    const caracteresQuebrados = (textoUtf8.match(/\uFFFD/g) || []).length;
    if (caracteresQuebrados > 3) {
        return new TextDecoder('iso-8859-1').decode(bytes);
    }
    return textoUtf8;
}

function handleImportFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
        toast('Selecione um arquivo .txt do relatório.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const texto = decodificarArquivoTexto(e.target.result);
        document.getElementById('import-textarea').value = texto;
        toast('Arquivo carregado! Clique em "Processar Relatório".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);

    event.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
}

function processarRelatorioImportacao() {
    try {
        const textarea = document.getElementById('import-textarea');
        if (!textarea) return toast('Erro interno: campo de texto não encontrado. Atualize a página (Ctrl+Shift+R) e tente de novo.');
        const texto = textarea.value;

        if (!texto || !texto.trim()) {
            return toast('Cole o texto do relatório antes de processar.');
        }

        const notas = parseRelatorioERP(texto);

        if (notas.length === 0) {
            document.getElementById('import-preview-container').innerHTML = `<div class="empty-state">Nenhuma nota fiscal foi reconhecida neste texto. Verifique se o conteúdo colado é o relatório correto.</div>`;
            return;
        }

        notasImportadasPreview = notas;
        mostrarApenasNovasImportacao = true;
        renderPreviewImportacao();
        toast(`${notas.length} nota(s) encontrada(s)!`);
    } catch (e) {
        console.error('Erro ao processar relatório:', e);
        toast('✕ Erro ao processar o relatório. Veja o console para detalhes.');
    }
}

// Alimenta o histórico/reconciliação do ERP (entradasErp) com TODAS as NFs
// reconhecidas no relatório colado, independente do checkbox de seleção —
// NUNCA cria nota no financeiro (notasCollection). Ação separada de
// confirmarImportacaoLote porque o usuário pode querer só consolidar os
// dados do ERP (Pré-seleção, Histórico, reconciliação da Fase 8) sem decidir
// ainda quais NFs específicas precisam de nota financeira agora. Idempotente
// (chaveEntradaErp = nf_serie, sempre .set() por chave) — pode ser clicado
// de novo com o mesmo relatório sem duplicar nada.
async function salvarHistoricoErpSemFinanceiro() {
    if (!notasImportadasPreview.length) return toast('Nada pra salvar — processe um relatório primeiro.');
    try {
        const resultado = await salvarEntradasErp(notasImportadasPreview);
        let msg = `✓ Histórico do ERP atualizado: ${resultado.salvos} nota(s) processada(s)`;
        if (resultado.associacoesSpDataAutomaticas > 0) msg += ` · +${resultado.associacoesSpDataAutomaticas} associação(ões) de SP Data preenchida(s) automaticamente`;
        if (resultado.erros > 0) msg += ` · ${resultado.erros} erro(s)`;
        toast(msg);
    } catch (e) {
        console.error('Erro ao salvar histórico do ERP:', e);
        toast('✕ Erro ao salvar o histórico do ERP.');
    }
}

function renderPreviewImportacao() {
    const container = document.getElementById('import-preview-container');
    if (!container) return;

    if (notasImportadasPreview.length === 0) {
        container.innerHTML = '';
        return;
    }

    const linhas = notasImportadasPreview.map((nota, idx) => {
        const apelidoEncontrado = encontrarApelidoFornecedor(nota.fornecedor);
        // NF + fornecedor são um dado absoluto: duas notas iguais ativas ao
        // mesmo tempo é sempre erro (reimportação do mesmo relatório), nunca
        // uma situação válida — por isso trava o checkbox, não só avisa.
        // Duplicata contra o HISTÓRICO (já arquivada) continua só um aviso,
        // porque reimportar algo já resolvido antes pode ser legítimo.
        const fornecedorExibido = (typeof apelidoEncontrado === 'string' && apelidoEncontrado) || (typeof nota.fornecedor === 'string' && nota.fornecedor) || 'Fornecedor não identificado';
        const duplicata = verificarDuplicidade(fornecedorExibido, nota.nf, nota.valor); // Fase 41: também por nº + valor
        const duplicataAtiva = !!(duplicata && duplicata.origem === 'pendente'); // Fase 40: tinha que vir DEPOIS de "duplicata" (ReferenceError ao importar o relatório ERP)
        const ignorado = fornecedoresIgnorados.has(fornecedorExibido) || fornecedoresIgnorados.has(nota.fornecedor);

        let status = 'novo';
        if (ignorado) status = 'ignorado';
        else if (duplicata) status = 'duplicata';

        return { nota, idx, apelidoEncontrado, fornecedorExibido, duplicata, duplicataAtiva, ignorado, status, recursoSugerido: sugerirRecursoImportacaoErp(nota) };
    });

    const totalNovas = linhas.filter(l => l.status === 'novo').length;
    const totalProcessadas = linhas.length - totalNovas;

    const itensHTML = linhas.map(({ nota, idx, apelidoEncontrado, fornecedorExibido, duplicata, duplicataAtiva, ignorado, status, recursoSugerido }) => {
        const avisosHTML = nota.avisos.length
            ? `<div class="import-avisos">${nota.avisos.map(a => `<div class="import-aviso"><i class="fa-solid fa-triangle-exclamation"></i> ${a}</div>`).join('')}</div>`
            : '';
        const badgeIgnorado = ignorado ? `<div class="import-badge import-badge-ignorado"><i class="fa-solid fa-ban"></i> Fornecedor ignorado — não entra na importação</div>` : '';
        const badgeDup = !duplicata ? '' : (
            duplicata.origem === 'historico'
                ? `<div class="import-badge import-badge-historico"><i class="fa-solid fa-box-archive"></i> Já foi arquivada antes${duplicata.nota.dataHistorico ? ` (em ${duplicata.nota.dataHistorico})` : ''}</div>`
                : `<div class="import-badge"><i class="fa-solid fa-triangle-exclamation"></i> Já existe uma nota pendente com este fornecedor + NF</div>`
        );
        const badgeApelido = apelidoEncontrado ? `<div class="import-badge import-badge-info"><i class="fa-solid fa-wand-magic-sparkles"></i> Apelido aplicado automaticamente (nome no relatório: "${typeof nota.fornecedor === 'string' ? nota.fornecedor : fornecedorExibido}")</div>` : '';

        return `
        <div class="nota-item import-item" data-import-idx="${idx}" data-status="${status}">
            <label class="import-checkbox-row">
                <input type="checkbox" class="import-check" data-idx="${idx}" ${status === 'novo' && !duplicataAtiva ? 'checked' : ''} ${duplicataAtiva ? 'disabled' : ''} onchange="atualizarContadorImportacao()">
                <span>Importar esta nota${nota.parcelas > 1 ? ` (parcelada ${nota.parcelas}x)` : ''}${duplicataAtiva ? ' — bloqueada (NF + fornecedor já pendente)' : ''}</span>
            </label>
            ${badgeIgnorado}
            ${badgeDup}
            ${badgeApelido}
            <div class="campo"><label>Fornecedor</label><input type="text" class="form-field import-field-forn" data-idx="${idx}" data-original="${escRel(nomeTextoSeguro(nota.fornecedor)).replace(/"/g, '&quot;')}" value="${fornecedorExibido}" onblur="handleEdicaoFornecedorImportacao(this)"></div>
            <div class="campo"><label>NF</label><input type="text" class="form-field import-field-nf" data-idx="${idx}" value="${nota.nf}"></div>
            <div class="campo"><label>Data</label><input type="text" class="form-field import-field-data" data-idx="${idx}" value="${nota.data}" oninput="formatarDataInput(this)"></div>
            <div class="campo"><label>Vencimento</label><input type="text" class="form-field import-field-venc" data-idx="${idx}" value="${nota.vencimento}" oninput="formatarDataInput(this)"></div>
            <div class="campo"><label>Valor Total</label><input type="text" class="form-field import-field-valor" data-idx="${idx}" value="${nota.valor}" onblur="formatarValorBlur(event)"></div>
            <div class="campo"><label>Recurso</label><select class="import-field-obs" data-idx="${idx}">${DOM.obs.innerHTML}${recursoSugerido && !observacoesSugeridas.includes(recursoSugerido) ? `<option value="${recursoSugerido}">${recursoSugerido}</option>` : ''}</select>${recursoSugerido ? `<div class="nota-detalhes">Sugerido pela Entrada de NF desta nota.</div>` : ''}</div>
            ${avisosHTML}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="card import-summary">
            <strong>${notasImportadasPreview.length}</strong> nota(s) fiscal(is) encontrada(s). Revise os campos abaixo (notas com aviso ⚠️ merecem atenção extra) e confirme a importação.
            <div class="import-toggle-novas">
                <div class="import-toggle-info"><strong>${totalNovas}</strong> nova${totalNovas === 1 ? '' : 's'} · <span>${totalProcessadas} já processada${totalProcessadas === 1 ? '' : 's'}</span></div>
                <button id="import-toggle-novas-btn" class="manage-toolbar-btn" onclick="toggleMostrarApenasNovasImportacao()">${mostrarApenasNovasImportacao ? `Mostrar Todas (${notasImportadasPreview.length})` : 'Mostrar Apenas Novas'}</button>
            </div>
            <div class="actions" style="margin-top:10px;">
                <button class="actions-button is-neutral" onclick="salvarHistoricoErpSemFinanceiro()">
                    <span class="icon-wrapper"><i class="fa-solid fa-database"></i></span>
                    Alimentar Histórico do ERP (todas as ${notasImportadasPreview.length}, sem gerar nota no financeiro)
                </button>
            </div>
            <div class="nota-detalhes" style="margin-top:2px;">Essa opção só salva os dados no histórico/reconciliação do ERP — não cria nada em Gerenciar Notas. Pode clicar quantas vezes quiser com o mesmo relatório, sem duplicar.</div>
            <div class="campo" style="margin-top:12px;"><input type="text" id="import-search" class="form-field" placeholder="Buscar por NF ou fornecedor..." oninput="filtrarPreviewImportacao(this.value)"></div>
            <div class="actions" style="gap: 10px; margin-top: 8px;">
                <button class="actions-button is-neutral" onclick="selecionarTodasImportacao(false)">Desmarcar Todas</button>
                <button class="actions-button is-neutral" onclick="selecionarTodasImportacao(true)">Marcar Todas</button>
            </div>
            <div class="import-bulk-recurso">
                <select id="import-bulk-recurso-select">${DOM.obs.innerHTML}</select>
                <button class="actions-button" onclick="aplicarRecursoEmLoteImportacao()">Aplicar Recurso às Marcadas</button>
            </div>
        </div>
        ${itensHTML}
        <div class="actions" style="margin-top: 8px;">
            <button class="actions-button is-primary" onclick="confirmarImportacaoLote()">
                <span class="icon-wrapper"><i class="fa-solid fa-check-double"></i></span>
                Importar Selecionadas (<span id="import-count-selected">${totalNovas}</span>)
            </button>
        </div>`;

    aplicarFiltrosPreviewImportacao();
    atualizarContadorImportacao();
    linhas.forEach(({ idx, recursoSugerido }) => {
        if (!recursoSugerido) return;
        const sel = container.querySelector(`select.import-field-obs[data-idx="${idx}"]`);
        if (sel) sel.value = recursoSugerido;
    });
}

// Aplica em conjunto o filtro de busca (NF/fornecedor) e o filtro de status
// ("mostrar apenas novas"), sem re-renderizar — preserva qualquer edição que
// o usuário já tenha feito nos campos.
function aplicarFiltrosPreviewImportacao() {
    const termo = (document.getElementById('import-search')?.value || '').trim().toUpperCase();
    document.querySelectorAll('.import-item').forEach(item => {
        const passaStatus = !mostrarApenasNovasImportacao || item.dataset.status === 'novo';
        let passaBusca = true;
        if (termo) {
            const nf = item.querySelector('.import-field-nf')?.value || '';
            const forn = item.querySelector('.import-field-forn')?.value || '';
            passaBusca = nf.toUpperCase().includes(termo) || forn.toUpperCase().includes(termo);
        }
        item.style.display = (passaStatus && passaBusca) ? '' : 'none';
    });
}

function filtrarPreviewImportacao() {
    aplicarFiltrosPreviewImportacao();
}

function toggleMostrarApenasNovasImportacao() {
    mostrarApenasNovasImportacao = !mostrarApenasNovasImportacao;
    const btn = document.getElementById('import-toggle-novas-btn');
    if (btn) btn.textContent = mostrarApenasNovasImportacao ? `Mostrar Todas (${notasImportadasPreview.length})` : 'Mostrar Apenas Novas';
    aplicarFiltrosPreviewImportacao();
}

// Aplica o Recurso escolhido a todas as notas atualmente marcadas (checkbox
// "Importar esta nota") — útil depois de buscar por um grupo de NFs e marcar
// só elas.
function aplicarRecursoEmLoteImportacao() {
    const recurso = document.getElementById('import-bulk-recurso-select').value;
    if (!recurso) return toast('Escolha um recurso antes de aplicar.');
    const marcadas = document.querySelectorAll('.import-check:checked');
    if (marcadas.length === 0) return toast('Nenhuma nota marcada para importar.');
    marcadas.forEach(chk => {
        const idx = chk.dataset.idx;
        const select = document.querySelector(`.import-field-obs[data-idx="${idx}"]`);
        if (select) select.value = recurso;
    });
    toast(`✓ Recurso aplicado a ${marcadas.length} nota(s) marcada(s).`);
}

// Aprendizado automático de apelido: quando o usuário corrige o nome do
// fornecedor de uma linha (ex: de "COMERCIAL CIRURGICA RIOCLARENS" pra
// "RIOCLARENSE"), o app salva essa correspondência como apelido permanente
// (pra já vir certo em relatórios futuros) e aplica a mesma correção nas
// outras linhas dessa mesma importação que ainda estejam com o nome original.
async function handleEdicaoFornecedorImportacao(input) {
    const original = nomeTextoSeguro(input.dataset.original);
    const novo = nomeTextoSeguro(input.value).toUpperCase();
    input.value = novo;

    if (!original || !novo || novo.toUpperCase() === original.toUpperCase()) return;
    if (apelidosFornecedores[original] === novo) return; // já estava salvo, nada a fazer

    apelidosFornecedores[original] = novo;
    try {
        await settingsDocRef.update({ [`apelidosFornecedores.${original}`]: novo });
    } catch (e) {
        try {
            await settingsDocRef.set({ apelidosFornecedores: { [original]: novo } }, { merge: true });
        } catch (e2) {
            console.error('Erro ao salvar apelido automático:', e2);
        }
    }
    await adicionarFornecedor(novo, true);
    popularListaApelidos();

    let outrasAfetadas = 0;
    document.querySelectorAll('.import-field-forn').forEach(el => {
        if (el === input) return;
        if (el.dataset.original === original && el.value.trim().toUpperCase() === original.toUpperCase()) {
            el.value = novo;
            outrasAfetadas++;
        }
    });

    toast(outrasAfetadas > 0
        ? `✓ Apelido "${novo}" salvo e aplicado a mais ${outrasAfetadas} nota(s) com "${original}".`
        : `✓ Apelido "${novo}" salvo para "${original}" — próximos relatórios já vêm certo.`);
}

function selecionarTodasImportacao(marcar) {
    document.querySelectorAll('.import-item').forEach(item => {
        if (item.style.display === 'none') return;
        const chk = item.querySelector('.import-check');
        if (chk) chk.checked = marcar;
    });
    atualizarContadorImportacao();
}

function atualizarContadorImportacao() {
    const total = document.querySelectorAll('.import-check:checked').length;
    const span = document.getElementById('import-count-selected');
    if (span) span.textContent = total;
}

async function confirmarImportacaoLote() {
    const checks = Array.from(document.querySelectorAll('.import-check'));
    const selecionadas = checks.filter(c => c.checked);

    if (selecionadas.length === 0) {
        return toast('Nenhuma nota marcada para importar. Se é só pra salvar os dados do ERP, use "Alimentar Histórico do ERP" acima.');
    }

    showConfirmModal({
        title: 'Confirmar Importação',
        message: `Criar ${selecionadas.length} nota(s) fiscal(is) na lista de notas pendentes (Gerenciar Notas)? O histórico do ERP dessas notas também será salvo/atualizado junto.`,
        confirmText: 'Sim, Importar',
        confirmClass: 'success',
        onConfirm: async () => {
            try {
                const batch = firestore.batch();
                const fornecedoresNovos = new Set();
                const vinculosErp = [];
                const checklistInicial = Object.keys(checklistDefinition).reduce((acc, key) => ({ ...acc, [key]: false }), {});
                checklistInicial.tirarFoto = false;

                selecionadas.forEach(chk => {
                    const idx = chk.dataset.idx;
                    const fornecedor = document.querySelector(`.import-field-forn[data-idx="${idx}"]`).value.trim().toUpperCase();
                    const nf = document.querySelector(`.import-field-nf[data-idx="${idx}"]`).value.trim();
                    const data = document.querySelector(`.import-field-data[data-idx="${idx}"]`).value.trim();
                    const vencimento = document.querySelector(`.import-field-venc[data-idx="${idx}"]`).value.trim();
                    const valor = document.querySelector(`.import-field-valor[data-idx="${idx}"]`).value.trim();
                    const obsEl = document.querySelector(`.import-field-obs[data-idx="${idx}"]`);
                    const obs = obsEl ? obsEl.value : '';

                    if (!fornecedor) return;

                    const novaNotaRef = notasCollection.doc();
                    vinculosErp.push({ idx, notaId: novaNotaRef.id });
                    batch.set(novaNotaRef, {
                        data,
                        nf,
                        vencimento,
                        valor,
                        fornecedor,
                        obs,
                        enviada: false,
                        dataCriacao: (new Date).toISOString(),
                        checklist: checklistInicial
                    });

                    if (fornecedor) fornecedoresNovos.add(fornecedor);
                });

                await batch.commit();

                for (const f of fornecedoresNovos) {
                    await adicionarFornecedor(f, true);
                }

                // Histórico entradasErp: salva TODOS os blocos reconhecidos no
                // relatório colado (não só as notas marcadas pra checklist) —
                // é uma fonte independente, isolada num try/catch próprio pra
                // uma falha aqui nunca comprometer a importação de notas que
                // acabou de funcionar acima.
                let msgEntradasErp = '';
                try {
                    const resultado = await salvarEntradasErp(notasImportadasPreview);
                    // Liga cada NF criada acima à sua entrada do ERP (mesmo registro,
                    // sem duplicar): as NFs marcadas deixam de ficar como "não
                    // decididas" e o arquivamento passa a sincronizar com o ERP.
                    await Promise.all(vinculosErp.map(v => {
                        const bloco = notasImportadasPreview[v.idx];
                        if (!bloco || !bloco.nf) return null;
                        return entradasErpCollection.doc(chaveEntradaErp(bloco))
                            .update({ statusFluxo: 'selecionada_financeiro', notaVinculadaId: v.notaId })
                            .catch(e => console.error('Erro ao vincular NF à entrada do ERP:', e));
                    }));
                    if (resultado.salvos > 0) msgEntradasErp = ` (+${resultado.salvos} no histórico de entradas do ERP)`;
                    if (resultado.associacoesSpDataAutomaticas > 0) msgEntradasErp += ` · +${resultado.associacoesSpDataAutomaticas} associação(ões) de SP Data preenchida(s) automaticamente`;
                } catch (e) {
                    console.error('Erro ao salvar histórico entradasErp:', e);
                }

                toast(`✓ ${selecionadas.length} nota(s) importada(s) com sucesso!${msgEntradasErp}`);

                notasImportadasPreview = [];
                document.getElementById('import-preview-container').innerHTML = '';
                document.getElementById('import-textarea').value = '';
            } catch (e) {
                console.error('Erro ao importar notas:', e);
                toast('✕ Erro ao importar as notas.');
            }
        }
    });
}
